---
title: "Patching NVIDIA's driver and vLLM to enable P2P on consumer GPUs"
date: 2026-02-25T23:59:00+10:00
tags:
  [
    'ai',
    'llm',
    'tech',
    'vllm',
    'llama.cpp',
    'gguf',
    'awq',
    'cuda',
    'nvidia',
    'gpu',
    'performance',
    'optimisation',
  ]
author: 'Sam McLeod'
showToc: true
TocOpen: true
draft: false
hidemeta: false
comments: false
summary: 'NVIDIA artificially restricts peer-to-peer (P2P) GPU communication to their enterprise cards. Turns out this is a software limitation, not a hardware one. I patched my drivers to remove it, hacked vLLM to take advantage of it, and got a 10-30% throughput improvement running Qwen 3.5 35b on dual RTX 3090s.'
disableShare: false
disableHLJS: false
hideSummary: false
searchHidden: false
ShowReadingTime: true
ShowBreadCrumbs: true
ShowPostNavLinks: true
ShowWordCount: true
ShowRssButtonInSectionTermList: true
UseHugoToc: true
mermaid: false
# cover:
#   image: "todo.jpg"
#   alt: "todo"
#   relative: true  # Set to true for page bundle images
---

NVIDIA artificially restricts peer-to-peer (P2P) GPU communication to their enterprise cards. Turns out this is a software limitation, not a hardware one. I patched my drivers to remove it, hacked vLLM to take advantage of it, and got a 10-30% throughput improvement running Qwen 3.5 35b on dual RTX 3090s.

## Why P2P Matters

When you run a model across multiple GPUs with tensor parallelism, the GPUs need to constantly exchange data. Without P2P, all inter-GPU communication goes through the CPU and system memory - a round trip that adds latency and chews through PCIe bandwidth inefficiently. With P2P enabled, GPUs can read and write directly to each other's memory over DMA, cutting out the middleman entirely.

Despite NVIDIA charging a premium for their consumer 90 series cards (RTX 3090, 4090, 5090) they block this feature in the driver. The hardware supports it fine in my experience - it's purely a product segmentation decision to push people towards their professional lineup where P2P is enabled.

## The Patch

A community fork of NVIDIA's open GPU kernel modules exists that aids with removing this restriction: [aikitoria/open-gpu-kernel-modules](https://github.com/aikitoria/open-gpu-kernel-modules).

The patch modifies the kernel driver to force enable BAR1 P2P mode on GPUs that aren't supposed to have it. Transfers then happen by writing directly to the other GPU's physical addresses over DMA.

### Prerequisites

IOMMU must be configured in passthrough mode. Without this, DMA transfers between GPUs will fail. Note that passthrough mode reduces IOMMU's isolation guarantees - if you're running untrusted software or devices in otherwise highly secure operating environments, understand the trade-off before doing this.

Edit `/etc/default/grub` and add `amd_iommu=on iommu=pt` (or `intel_iommu=on iommu=pt` for Intel) to `GRUB_CMDLINE_LINUX`:

```bash
GRUB_CMDLINE_LINUX="rd.lvm.lv=fedora/root amd_pstate=guided nvidia-drm.modeset=1 amd_iommu=on iommu=pt"
```

Then regenerate grub and reboot:

```bash
# Fedora:
sudo grub2-mkconfig -o /boot/grub2/grub.cfg
sudo dracut --regenerate-all --force

# Debian-based distros:
# sudo update-grub
```

### Installing the Patched Drivers

1. Find the latest supported patched driver version by looking at the latest branch in [aikitoria/open-gpu-kernel-modules](https://github.com/aikitoria/open-gpu-kernel-modules) (`590.48.01` at the time of writing this)
2. Download the matching [NVIDIA driver](https://www.nvidia.com/en-us/drivers/details/258750/) version
3. When installing the driver select the open source driver (so we can modify it with the patch)
4. Clone the repo and run `./install.sh`, when it completes it will show the nvidia-smi output
5. Reboot

### Verify P2P is Working

```
nvidia-smi topo -p2p r
        GPU0    GPU1
 GPU0   X       OK
 GPU1   OK      X
Legend:
  X    = Self
  OK   = Status Ok
  CNS  = Chipset not supported
  GNS  = GPU not supported
  TNS  = Topology not supported
  NS   = Not supported
  U    = Unknown
```

If you see `OK` between your GPUs instead of `NS`, P2P is active.

---

## Patching vLLM

My daily LLM inference server is llama.cpp, which is far more user friendly and flexible than vLLM, however vLLM's performance is usually superior as such for especially heavy or performance sensitive workloads I sometimes switch to spinning up vLLM.

vLLM has a very efficient implementation of tensor parallelism especially for MoE models, so for workloads that need those features it's often the best choice if you can wear the pain points.

vLLM comes with many downsides:

- It's more difficult to setup
- Every model requires its own set of configuration parameters
- Its topology constraints can be sub-optimal for setups with an uneven number of GPUs
- It has limited support for quantisation formats such as GGUF, it does support AWQ quants but they're not as common, especially at anything other than 4-bit and 8-bit (dynamic) precision
- Its vRAM -> RAM offloading functionality is experimental and not as robust or flexible as llama.cpp's, so it's only suitable if the models will fit entirely in GPU memory
- vLLM's OpenAI compatible API server requires setting static configuration at launch. This means that the model must be set to load when the server starts (no hot-swapping / dynamic loading) and does not free up vRAM when models are idle. _Note: This could be worked around by coupling with MostlyGeek's fantastic [llama-swap](https://github.com/mostlygeek/llama-swap) project but that's beyond the scope of this post._

To top it all off - vLLM has a device capability check that rejects P2P on consumer GPUs - even if they're compatible (useful, no?). Even with the driver patch applied and P2P operational, vLLM will refuse to use it.

It turns out the check lives in `vllm/platforms/cuda.py` and queries `pynvml` for P2P support - which still reports the card as unsupported because the user-space library vLLM uses has hard coded logic and as such - doesn't know about the support that's been added to our driver.

I bypassed this with a one-liner in my vLLM Dockerfile:

```dockerfile
RUN sed -i 's/handles = \[pynvml.nvmlDeviceGetHandleByIndex(i) for i in physical_device_ids\]/return True/g' \
    /usr/local/lib/python3.12/dist-packages/vllm/platforms/cuda.py
```

This is a dirty hack - it short-circuits the P2P check to always return `True`. It works, but you'd want to be more surgical about it if you're doing this for anything beyond a personal inference server.

---

## Tuning vLLM's Fused MoE Kernel

### What is fused_moe?

MoE models (like Qwen 3.5) route each token through a subset of "expert" sub-networks. At inference time, this means running a batch of matrix multiplications - one per active expert - every forward pass. The naive approach runs these as separate GEMM operations, but vLLM fuses them into a single Triton kernel called `fused_moe`. This kernel combines the routed weight application, the matrix multiplications, and the activation function into one GPU dispatch, avoiding the overhead of launching many small kernels separately.

The performance of this kernel depends heavily on how its work is tiled across the GPU's streaming multiprocessors. Parameters like block sizes (`BLOCK_SIZE_M`, `BLOCK_SIZE_N`, `BLOCK_SIZE_K`), the number of warps, pipeline stages, and group sizes all affect how efficiently the kernel uses the GPU's compute units, shared memory, and L2 cache.

### Why tune it?

vLLM ships with pre-tuned configurations for datacenter GPUs (A100, H100, B200, etc). Consumer cards like the RTX 3090 are not included. Without a tuned config, vLLM falls back to heuristic defaults and logs a warning:

```
WARNING ... Using default MoE config. Performance might be sub-optimal!
```

The defaults are conservative and leave performance on the table. The RTX 3090's Ampere architecture has different SM counts, shared memory sizes, and cache hierarchies compared to the datacenter cards these defaults target.

### Generating a tuned config

vLLM includes a benchmarking script that searches over the Triton kernel parameter space and finds the fastest configuration for your specific hardware, however it takes a very long time to run (many hours) as its search space is huge (~1900 configurations per batch size).

I came across [MissionSquad/vllm-moe-configs](https://github.com/MissionSquad/vllm-moe-configs) repo, which provides an incredibly useful patch that makes this tuner workable on single-GPU consumer setups by narrowing the search space from ~1900 configurations down to a manageable number while retaining most of the performance benefits.

The output is a JSON file named by expert count, intermediate size, and device - for example `E=48,N=768,device_name=NVIDIA_GeForce_RTX_3090.json`. Each entry maps a batch size to the optimal block dimensions, warp count, and pipeline stages:

```json
{
  "triton_version": "3.5.1",
  "1": {
    "BLOCK_SIZE_M": 64,
    "BLOCK_SIZE_N": 128,
    "BLOCK_SIZE_K": 128,
    "GROUP_SIZE_M": 32,
    "num_warps": 8,
    "num_stages": 3
  },
  "16": {
    "BLOCK_SIZE_M": 64,
    "BLOCK_SIZE_N": 128,
    "BLOCK_SIZE_K": 128,
    "GROUP_SIZE_M": 16,
    "num_warps": 8,
    "num_stages": 3
  },
  ...
}
```

The full config covers batch sizes from 1 through 4096. I've published mine as a [gist](https://gist.github.com/sammcj/e45c2ad08a4191f0fbbaa1b842a5a778).

### Using the tuned config

Drop the JSON file into vLLM's config directory or point vLLM at it with the `VLLM_TUNED_CONFIG_FOLDER` environment variable:

```bash
VLLM_TUNED_CONFIG_FOLDER=/path/to/configs vllm serve ...
```

On startup, vLLM should no longer print the "Using default MoE config" warning. The tuned parameters ensure the Triton kernel is compiled with block sizes and pipeline depths that match what the RTX 3090 can actually execute efficiently, rather than relying on conservative guesses.

## Results

Running Qwen 3.5 35b-a3b (a MoE model with ~3 billion active parameters per token) with 64k context on dual RTX 3090s:

| Setting                | Value                 | Without P2P |
| ---------------------- | --------------------- | ----------- |
| vLLM version           |                       |             |
| llama.cpp version      |                       |             |
| Model                  | Qwen 3.5 35b-a3b      |             |
| Context length         | 64k                   |             |
| vLLM Quantisation      | 4-bit (Dynamic) AWQ   |             |
| llama.cpp Quantisation | Unsloth UD-Q4_K_XL    |             |
| Inference engine       | vLLM                  |             |
| GPUs                   | 2x RTX 3090           |             |
| CPU                    | Ryzen 9 9900X 12-core |             |
| RAM                    | 192GB DDR5 3600 MT/s  |             |
| P2P                    | Enabled               | Disabled    |
| Fused MoE config       | Tuned                 | Tuned       |


| Server/Model            | Value            | Without P2P   |
| ----------------------- | ---------------- | ------------- |
| **llama.cpp / 35b-a3b** | **110-130 tk/s** | Untested      |
| **vLLM / 35b-a3b**      | **120-190 tk/s** | ~120-145 tk/s |
| **llama.cpp / 27b**     | **30-70 tk/s**   | Untested      |
| **vLLM / 27b**          | **32-195 tk/s**  | ~32-140 tk/s  |

That's a 10-30% improvement over the same configuration without the P2P patch and MoE tuning, depending on the workload. The gain varies with batch size, sequence length, and how much inter-GPU communication the model actually needs. MoE architectures like Qwen 3.5 benefit particularly well since expert routing creates more cross-GPU traffic during tensor parallel inference, and the fused_moe kernel is on the critical path for every token generated.

_Note: I'd love to break down the performance improvements in more detail including without the Fused MoE - perhaps when time allows I'll update this post._

## Configuration

### vLLM

#### Dockerfile

```dockerfile
FROM vllm/vllm-openai:cu130-nightly

ENV LD_LIBRARY_PATH=/usr/lib64:/usr/local/nvidia/lib64:/usr/local/cuda/lib64:/usr/local/nvidia/lib:/lib/x86_64-linux-gnu:/usr/local/cuda/lib64
ENV CUDA_VERSION=130
ENV UV_TORCH_BACKEND=cu130

# Install latest transformers, numba and vLLM
RUN uv pip install --system -U https://github.com/huggingface/transformers/archive/refs/heads/main.zip
RUN uv pip install --system --force-reinstall numba
RUN uv pip install --system -U vllm --torch-backend=auto --extra-index-url https://wheels.vllm.ai/nightly

# Fix for RTX 3090 with P2P enabled via patched driver
RUN sed -i 's/handles = \[pynvml.nvmlDeviceGetHandleByIndex(i) for i in physical_device_ids\]/return True/g' /usr/local/lib/python3.12/dist-packages/vllm/platforms/cuda.py

EXPOSE 8000
ENTRYPOINT ["python3", "-m", "vllm.entrypoints.openai.api_server"]
```

#### Docker Compose

```yaml
services:
  &name vllm:
    container_name: *name
    hostname: *name
    profiles:
      - *name
    build:
      context: ./vllm # Dockerfile below
    ipc: host
    environment:
      # NVIDIA settings
      NVIDIA_VISIBLE_DEVICES: all
      NVIDIA_DRIVER_CAPABILITIES: all
      NVIDIA_DISABLE_REQUIRE: '1'
      CUDA_VISIBLE_DEVICES: '0,1'
      CUDA_DEVICE_ORDER: FASTEST_FIRST
      CUDA_DEVICE_MAX_CONNECTIONS: 10
      CUDA_CACHE_MAXSIZE: 4294967296 # 4GB
      CUDA_SCALE_LAUNCH_QUEUES: '4x'
      NCCL_CUMEM_ENABLE: 1
      RAY_memory_monitor_refresh_ms: 0

      # https://docs.vllm.ai/en/latest/configuration/env_vars/
      FLASH_ATTN: 1
      OMP_NUM_THREADS: 6
      PYTORCH_ALLOC_CONF: 'expandable_segments:False'
      TENSOR_PARALLEL_SIZE: 2
      VLLM_CPU_KVCACHE_SPACE: 8 # (gb)
      VLLM_DO_NOT_TRACK: 1
      VLLM_FLASHINFER_MOE_BACKEND: throughput
      VLLM_MARLIN_USE_ATOMIC_ADD: 1
      VLLM_SLEEP_WHEN_IDLE: 1
      VLLM_TARGET_DEVICE: cuda
      VLLM_USE_PRECOMPILED: 1
      VLLM_ENABLE_CUDAGRAPH_GC: 1

      VLLM_TUNED_CONFIG_FOLDER: /tuned_configs # Contains my fused MoE kernels

      # Qwen 3.5 specific settings
      VLLM_USE_FLASHINFER_MOE_FP16: '1'
      VLLM_USE_FLASHINFER_SAMPLER: '1' # I did have this as 0, but it _might_ be faster with it on
      VLLM_USE_DEEP_GEMM: 0

    command:
      - '--served-model-name'
      - 'vLLM'
      - '--tensor-parallel-size' # split across 2 GPUs
      - '2'
      - "--attention-backend"
      - "FLASHINFER"

      # memory optimisation
      # https://docs.vllm.ai/en/stable/configuration/optimization.html
      - '--max-model-len'
      - '131070'
      - '--max-num-batched-tokens'
      - '6144'
      - '--max-num-seqs'
      - '32'
      - '--gpu-memory-utilization'
      - '0.9'
      - '--swap-space'
      - '16'

      ## Qwen 3.5 specific settings
      - '--model'
      - 'cyankiwi/Qwen3.5-35B-A3B-AWQ-4bit'    # 35b-a3b
      # - "cyankiwi/Qwen3.5-27B-AWQ-BF16-INT4" # 27b - linear attention layers kept at full-precision
      - '--tool-call-parser'
      - 'qwen3_coder'
      - '--reasoning-parser'
      - 'qwen3'
      - '--enable-auto-tool-choice'
      - '--speculative-config' # speculative decoding (drafting) using MTP (model-based token prediction)
      - '{"method":"mtp","num_speculative_tokens":5}'
      - "--override-generation-config"
      - '{"temperature": 0.7, "repetition_penalty": 1.0, "presence_penalty": "1.5", "top_k": 20}'

      - '--enable-expert-parallel' # MoE models only, disable for 27b model
      - '--enable-prefix-caching'
      - '--enable-chunked-prefill'

    runtime: nvidia
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: ['compute', 'utility', 'graphics', 'video']
            - driver: cdi
              device_ids:
                - nvidia.com/gpu=all
              capabilities: ['compute', 'utility', 'graphics']
```

### llama.cpp

I use [llama-swap](https://github.com/mostlygeek/llama-swap) for hot loading models with llama.cpp, my real configuration uses a number of macros so I've compiled relevant parts of the config roughly as follows:

```yaml

models:
  "qwen3-5-35b-a3b-ud-q4kxl-64k-coding-instruct":
    ttl: 300 # 5 minutes
    env:
      - CUDA_SCALE_LAUNCH_QUEUES=4x
      - CUDA_CACHE_MAXSIZE=4294967296
      - GGML_CUDA_GRAPH_OPT=1
      - LLAMA_SET_ROWS=1
      - LLAMA_ARG_KV_SPLIT=false
    cmd: >
    # server
      --slots --metrics --props
      --threads -1 --threads-batch -1 --threads-http -1 --prio-batch 2 --prio 2
      --flash-attn on --cache-type-k q8_0 --cache-type-v q8_0
    # note: don't use --cache-reuse with Qwen 3.5 MoE models until https://github.com/ggml-org/llama.cpp/issues/18497 is resolved
      --no-context-shift --keep -1 --cache-reuse 256
      --cache-ram -1
      --kv-unified
      --no-mmap
      --jinja
      --fit on

    # 64k context
      --ctx-size 65535

    # ngram speculative decoding
      --spec-type ngram-mod --spec-ngram-size-n 24 --draft-min 48 --draft-max 64

    # qwen 3.5 - set for coding (instruct, no thinking)
      --temp 0.6 --top-k 20 --top-p 0.95 --min-p 0.00 --presence-penalty 0.0 --repeat-penalty 1.0
      --chat-template-kwargs "{\"enable_thinking\": false}"

      --mmproj /models/Qwen3.5-35B-A3B-UD-mmproj-bf16.gguf
      --model /models/Qwen3.5-35B-A3B-UD-Q4_K_XL.gguf
```

Note: These parameters are not necessarily the perfect optimally tuned settings as the model only came out yesterday, so I haven't had a lot of time to experiment with it yet. If you have a recommendation for better settings for this model [please let me know](https://smcleod.net/contact/)!

---

Enjoy!
