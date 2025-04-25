---
title: "Guide to LLM Sampling Settings (Ollama/Llama.cpp Edition)"
date: 2025-04-25T01:10:00+10:00
tags: ["ai", "llm", "tech", "ollama", "coding", "sampling", "inference", "tutorials", "llama"]
author: "Sam McLeod"
showToc: true
TocOpen: true
draft: false
hidemeta: false
comments: false
description: "A comprehensive guide to sampling parameters for LLMs using Ollama"
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
mermaid: true
---

Large Language Models (LLMs) like those used in Ollama don't generate text deterministically - they use probabilistic sampling to select the next token based on the model's prediction probabilities. How these probabilities are filtered and adjusted before sampling significantly impacts the quality of generated text.

This guide explains the key sampling parameters and how they affect your model's outputs, along with recommended settings for different use cases.

## Core Sampling Parameters

### Temperature

**What it does:** Controls how the model's token prediction probabilities are scaled, affecting randomness.

- **Low temperature (0.1-0.5):** Makes high-probability tokens more likely and low-probability tokens less likely
- **Medium temperature (0.6-0.9):** Provides a balance between predictability and creativity
- **High temperature (>1.0):** Flattens probability distributions, making diverse and sometimes unexpected outputs more likely

**How it works mathematically:** Temperature divides the raw logit scores before they're converted to probabilities. Lower temperatures amplify differences between token probabilities, while higher temperatures reduce these differences:

- At temperature = 0.5, differences between token logits are doubled
- At temperature = 2.0, differences between token logits are halved
- As temperature approaches infinity, all tokens approach equal probability

Interaction with Filtering: Remember that temperature is typically applied after filtering methods like Top K/P/Min P (see Sampler Ordering). This allows for using higher temperatures (like 1.0) more safely, as they primarily increase diversity among tokens already deemed plausible by the filters.

> [!INFO] A Logit refers to the raw, unnormalised output values produced by a classification model.
> These values are typically transformed through a function like the softmax function to produce probabilities.
> The term "logit" comes from logistic regression, where it refers to the log-odds of a probability. In deep learning, logits have a significant role in various loss functions and layers.

**Important concept:** Temperature is *non-linear* in its effects, with changes having most impact at lower values:

- At 0.5 temperature, a token with high probability becomes significantly more likely than at 1.0
- Temperature changes have diminishing returns at certain thresholds

**Best practice:** Apply temperature *after* other sampling methods like Top K, Top P or Min P. This is critical to ensure that filtered tokens remain excluded.

### Top P (Nucleus Sampling)

**What it does:** Restricts token selection to the smallest possible set of tokens whose cumulative probability exceeds the Top P value.

- **How it works:** If Top P = 0.9, the model will only consider tokens until their cumulative probability reaches 90%
- **Problems:**
  - When probabilities are spread out: Can include too many low-probability tokens, risking incoherence
  - When one token dominates (>90% probability): Can exclude reasonable alternatives, limiting diversity
  - Doesn't adapt well to varying confidence levels in different contexts

**When to use:** Good as a general sampling method, but consider Min P for better results in most scenarios.

### Min P

**What it does:** Only considers tokens that have at least X% of the probability of the most likely token.

- **How it works:** If Min P = 0.1 and the most likely token has 80% probability, only tokens with at least 8% probability will be considered
- **Advantage:** Dynamically adapts to the model's confidence level in each context, preventing both:
  - Inclusion of too many low-probability tokens (avoiding incoherence when confidence is spread out)
  - Exclusion of reasonable alternatives (preserving diversity when one token dominates)

**Why it's often better than Top P:** Min P's adaptive quality makes it more reliable across varied contexts:

- When the model is very confident (top token has high probability), Min P allows fewer alternatives
- When the model is less confident (probabilities more evenly distributed), Min P allows more alternatives
- This self-adjusting behaviour leads to more consistent and contextually appropriate outputs

**Recommended values:** 0.05-0.1 provides a good balance between coherence and creativity.

### Top K

**What it does:** Only considers the K most likely tokens, regardless of their probabilities.

- **How it works:** If Top K = 40, only the 40 highest-probability tokens are eligible for selection.
- **Limitation:** Fixed-count filter can be:
  - Too restrictive when many reasonable alternatives exist
  - Too permissive when few tokens have meaningful probability
  - Unable to adapt to the model's confidence level in different contexts
- Top K is sometimes used when needing extremely focused outputs in highly factual scenarios.

**Recommendation:** For most use cases, leave Top K at 0 (disabled) and rely on Min P.

### Repetition Penalty

**What it does:** Reduces the probability of tokens that have already appeared in the generated text.

- **How it works:** Applies a penalty to each token's logit (pre-softmax) when that token has already appeared in the last N tokens, thereby reducing its probability after softmax.
- **Caution:**
  - Can interfere with intentional repetition (like formatting characters, code syntax, or legitimate word repetition)
  - Acts as a "bandaid fix" that may mask underlying issues with other sampling parameters
  - Can produce awkward phrasing as the model tries to avoid natural repetition
  - Align `repeat_last_n` with your content type (e.g. 64 for prose, 128-512 for code). Very large values may slow sampling.
  - Never exceed 1.2 for `repeat_penalty` to avoid overly distorted outputs.

**Recommended values:**

- General use: 1.0-1.1, usually 1.05
- When repetition is an issue: up to 1.2
- Never exceed 1.2 as it can severely distort outputs

## Advanced Parameters

### Mirostat

**What it does:** Dynamically adjusts sampling parameters to maintain a target **entropy** level (cross-entropy in nats), reflecting how "surprised" the model is by its own outputs.

- **Modes:**
  - 0: Disabled
  - 1: Mirostat
  - 2: Mirostat 2.0 (improved algorithm with faster convergence)
- **Parameters:**
  - `mirostat_tau`: Target entropy (lower = more focused, higher = more diverse)
  - `mirostat_eta`: Learning rate for entropy adjustment (how quickly algorithm adapts)
  - When using Mirostat, set `top_p` 1.0 and `min_p` 0.0 so it alone controls truncation

**When to use Mirostat:**

- Long-form text generation where controlling consistency over many tokens is important
- When you want adaptive sampling that prevents quality degradation in extended outputs
- If you prefer adaptive sampling over manual tuning of temperature, Min P, etc.

**Recommended values:**

- `mirostat`: 2 (Mirostat 2.0 algorithm)
- `mirostat_tau`: 5.0 (balanced) to 2.0 (focused)
- `mirostat_eta`: 0.1 (default)

### Other Parameters

- **Seed:** Fixed seed ensures reproducible results
- **num_ctx:** Context window size
- **repeat_last_n:** How far back to look for repetition
- **num_predict:** Maximum tokens to generate

## Recommended Settings by Use Case

### General Purpose / Balanced

```plain
temperature: 0.8
min_p: 0.05
top_p: 0.9
top_k: 0
repeat_penalty: 1.05
```

### Factual / Precise

```plain
temperature: 0.3
min_p: 0.1
top_k: 40
repeat_penalty: 1.05
```

### Creative / Diverse

```plain
temperature: 1.0
min_p: 0.05
top_p: 0.95
repeat_penalty: 1.0
```

### Code Generation

Code generation is a somewhat special case, we often have lots of repetition and we want to be precise - but not restrict out of the box thinking.

Unless the models authors recommend otherwise, I usually default to:

```plain
temperature: 0.2
min_p: 0.05
top_p: 0.9
repeat_penalty: 1.05
```

> [!NOTE] Claude Recommended Coding Parameters
> I also asked Claude Sonnet 3.7 to provide some interesting code generation inference parameters to try.
> It provided a number of interesting suggestions, which I have included at the end of this post.
> - See the [Coding Parameters as suggested by Claude Sonnet 3.7](#coding-parameters-as-suggested-by-claude-sonnet-37).

---

## Sampler Ordering Best Practices

The order in which sampling methods are applied matters significantly and directly impacts output quality:

1. **First:** Apply truncation methods (Top K, Top P, Min P) to filter unreasonable tokens
2. **Last:** Apply temperature to scale the remaining probabilities

- logits
  - → apply Top K / Top P / Min P
  - → divide by temperature
  - → softmax
  - → sample next token

**Why this order is critical:**

- Truncation methods should first remove low-probability tokens from consideration
- Temperature then rescales the remaining token probabilities
- Applying temperature before truncation could inadvertently allow low-quality tokens back into consideration

Most implementations (including llama.cpp) apply temperature last by default, which is the recommended approach.

## Troubleshooting Common Issues

### Model keeps repeating itself

**First steps:**

1. Check for prompt issues - ensure your prompt doesn't encourage repetition
2. Verify context window isn't full - repetition often occurs when context is exhausted

**Parameter adjustments (in order of priority):**

1. Increase repetition penalty gradually (try 1.05, 1.1, 1.15, max 1.2)
2. Try increasing min_p to 0.1 to reduce low-probability continuations
3. Lower temperature slightly (0.6 or 0.7) if using higher values

### Outputs are too random/incoherent

**Parameter adjustments (in order of priority):**

1. Use Min P instead of Top P with value 0.1
2. Lower temperature gradually (try 0.7, then 0.5)
3. If still problematic, consider enabling Top K = 40 as a last resort

### Outputs are too generic/predictable

**Parameter adjustments (in order of priority):**

1. Increase temperature gradually (0.9, then 1.0)
2. Lower Min P value to 0.05 or 0.03
3. Ensure Top K is disabled (set to 0)

### Model generates incorrect facts

**Parameter adjustments (in order of priority):**

1. Lower temperature significantly (0.3 or even 0.1)
2. Increase Min P to 0.1 or 0.15
3. Consider adjusting prompting strategy to encourage factual accuracy

## Summary

Sampling settings greatly impact your model's performance. For most use cases:

1. Try Min P (0.05-0.1) with temperature (0.7-0.9) for a good balance
2. Apply temperature last in your sampler order
3. Use repetition penalty sparingly (1.0-1.2)
4. Experiment with settings based on your specific needs

Remember that different models may respond differently to these settings, so some experimentation will help you find optimal parameters for your specific model and use case.

---

## Ollama Sampling Settings Tables

# Ollama Settings for Different Use Cases

## Quick Reference Table

| Setting        | General Purpose | Factual/Precise | Creative Writing | Code Generation | Creative Chat |
|----------------|-----------------|-----------------|------------------|-----------------|---------------|
| temperature    | 0.7             | 0.3             | 1.0              | 0.2             | 0.9           |
| min_p          | 0.05            | 0.1             | 0.05             | 0.05            | 0.05          |
| top_p          | 0.9             | 0.8             | 0.95             | 0.9             | 0.95          |
| top_k          | 40 (default)    | 0*              | 0                | 40 (default)    | 0 (default)   |
| repeat_penalty | 1.1             | 1.05            | 1.0              | 1.05            | 1.15          |
| repeat_last_n  | 64              | 64              | 64               | 128             | 64            |
| mirostat       | 0               | 0               | 0                | 0               | 0             |

*Note: For factual/precise use cases, some guides recommend Top K = 40, but Min P generally provides better adaptive filtering. Consider using Min P alone with a higher value (0.1) for most factual use cases.

## Modelfile Examples

Note: These only serve as a *starting place*, every model is different and you should check to see if the authors have provided any recommendations. For example with Gemma 3, the authors recommend `temperature=1`, `top_k=64`,
`top_p=0.95`.

### General Purpose Preset

```env
PARAMETER temperature 0.7
PARAMETER min_p 0.05
PARAMETER top_p 0.9
PARAMETER repeat_penalty 1.05
PARAMETER repeat_last_n 64
```

### Factual/Precise Preset

```env
PARAMETER temperature 0.3
PARAMETER min_p 0.1
PARAMETER top_p 0.8
PARAMETER repeat_penalty 1.05
PARAMETER repeat_last_n 64
```

### Code Generation Preset

```env
PARAMETER temperature 0.2
PARAMETER min_p 0.05
PARAMETER top_p 0.9
PARAMETER repeat_penalty 1.05
```

I have found the following to work well with models like Qwen 2.5 Coder 32b:

```env
PARAMETER temperature 0.2
PARAMETER min_p 0.9
PARAMETER top_p 1
PARAMETER repeat_penalty 1.05
```

The Key Difference: The min_p value increased dramatically from 0.05 to 0.9.

>[!QUESTION] Why Might min_p=0.9 Work for Qwen Coder?
> **Model Characteristics**: The Qwen 2.5 Coder model might naturally produce very "peaked" probability distributions for code, meaning its top prediction is often significantly more likely than any alternatives.
>
> In this scenario, a high min_p simply reinforces the model's strong preference, leading to consistent and predictable (if potentially less flexible) code.
>
> **Task Specificity**: If you primarily use it for tasks demanding extreme precision or consistency where there's usually only one "correct" next token (like strict syntax adherence or completing boilerplate), this setting could perform well by aggressively pruning alternatives.
>
> **Synergy with Low Temperature**: The low temperature=0.2 already sharpens the probability distribution. Combining it with min_p=0.9 pushes the model very close to deterministic output, almost always picking the single most likely token.
>
> - `min_p=0.9` Interpretation: This setting is extremely restrictive. It dictates that the model should only consider tokens that have a probability at least 90% as high as the single most probable token. For example, if the top token has a 60% probability, any token with less than 54% (0.9 * 60%) probability is discarded before sampling. This forces the model to stick very closely to its most confident prediction at each step.
> - Interaction with `top_p=1.0`: Disabling top_p (setting it to 1.0) makes sense in conjunction with such a high min_p.
> - The `min_p=0.9` filter is already so aggressive that applying a top_p filter on top of it would be redundant or even counterproductive. min_p becomes the dominant (and almost sole) factor in deciding which tokens are eligible.

### Creative Writing Preset

```env
PARAMETER temperature 1.0
PARAMETER min_p 0.05
PARAMETER top_p 0.95
PARAMETER top_k 0
PARAMETER repeat_penalty 1.0
PARAMETER repeat_last_n 64
```

### Creative Chat Preset

```env
PARAMETER temperature 0.9
PARAMETER min_p 0.05
PARAMETER top_p 0.95
PARAMETER top_k 0
PARAMETER repeat_penalty 1.15
PARAMETER repeat_last_n 64
```

## When to Adjust Settings

### Increase Temperature When

- Responses are too generic or predictable
- You want more creative or diverse outputs
- Model seems to be in a "safe mode" defaulting to common responses

### Decrease Temperature When

- Responses are too random or incoherent
- You need factual accuracy
- Model is hallucinating or making things up

### Use Min P Instead of Top P When

- You notice the model including unlikely or nonsensical options
- You want to maintain diversity while ensuring coherence
- Response quality varies significantly between similar prompts

### Increase Repetition Penalty When

- Model is getting stuck in loops
- Text has excessive repetition of phrases or ideas
- Model keeps reusing the same examples or patterns

### Avoid High Repetition Penalty When

- Working with code (where repetition is often necessary)
- Model is avoiding necessary repetition (like in lists)
- You notice awkward phrasing to avoid repetition

## Command-Line Usage Example

```bash
ollama run mistral:latest -m "Describe quantum computing" \
  --temperature 0.7 \
  --min-p 0.05 \
  --top-p 0.9 \
  --repeat-penalty 1.1
```

---

## Ollama Sampling Diagram

[![Click to open larger image](ollama-sampling-diagram.png)](ollama-sampling-diagram.png)

---

## Sampling Methods Comparison

[![Click to open larger image](sampling-methods-comparison.png)](ollama-sampling-methods-comparison.png)

---

## Coding Parameters as suggested by Claude Sonnet 3.7

I provided this blog post to Claude Sonnet 3.7 and asked it to provide a number of interesting code generation inference paramaters I could try:

> Code inherently contains more intentional repetition than creative text—variable names, function calls, syntax patterns, and structural elements often need to repeat precisely for the code to function correctly.
>
> ### Key Considerations for Code Generation
>
> 1. **Repetition handling is critical**: Using low or no repeat penalties (1.0-1.03) generally works better for code than for text.
> 2. **Context length matters**: Longer repeat lookback windows (128-512) help maintain consistency in variable naming and patterns.
> 3. **Temperature sweet spot**: For most code tasks, 0.1-0.4 works better than higher values.
> 4. **Precision vs. creativity trade-off**: Lower values (0.1-0.2) for critical implementations, slightly higher (0.3-0.4) when multiple valid approaches exist.
>
> The optimal settings will vary somewhat depending on the specific programming language, complexity of the task, and the base model's characteristics. You may need to experiment and adjust based on your specific use case and the model you're using with Ollama.
>
> Here are several optimised inference parameter configurations for code generation, each with different focuses and trade-offs:
>
> ### Precision-Focused Code Generation
>
> ```plain
> temperature: 0.2
> min_p: 0.1
> top_p: 0.95
> top_k: 40
> repeat_penalty: 1.02
> repeat_last_n: 128
> ```
>
> **Reasoning**: Very low temperature for maximum determinism, slightly higher min_p to exclude unlikely tokens, minimal repeat penalty to preserve necessary repetition in code structures. Best for exact implementations where correctness is critical.
>
> ### Balanced Code Generation
>
> ```plain
> temperature: 0.3
> min_p: 0.05
> top_p: 0.9
> top_k: 0
> repeat_penalty: 1.03
> repeat_last_n: 256
> ```
>
> **Reasoning**: Low but not extreme temperature balances determinism with flexibility, standard min_p, disabled top_k to rely on probability-based filtering, very light repeat penalty with extended lookback window. Good general-purpose code settings.
>
> ### Pattern-Respecting Code Generation
>
> ```plain
> temperature: 0.4
> min_p: 0.05
> top_p: 0.95
> top_k: 0
> repeat_penalty: 1.0
> repeat_last_n: 64
> ```
>
> **Reasoning**: Slightly higher temperature allows more implementation variations, no repeat penalty at all to fully respect code patterns and variable naming consistency. Shorter lookback window assumes repeats are intentional. Good for generating code that follows established patterns closely.
>
> ### Mixed-Complexity Code Generation
>
> ```plain
> temperature: 0.25
> min_p: 0.08
> top_p: 0.92
> top_k: 20
> repeat_penalty: 1.03
> repeat_last_n: 256
> mirostat: 2
> mirostat_tau: 4.0
> mirostat_eta: 0.1
> ```
>
> **Reasoning**: Low temperature with adaptive complexity control via mirostat, moderate filtering parameters. The mirostat helps manage complexity consistently throughout longer code generations. Good for larger code blocks with varying complexity sections.
>
> ### Algorithm Implementation
>
> ```plain
> temperature: 0.15
> min_p: 0.1
> top_p: 0.9
> top_k: 30
> repeat_penalty: 1.05
> repeat_last_n: 64
> ```
>
> **Reasoning**: Very low temperature for maximum correctness in mathematical logic, higher min_p and moderate top_k to strictly filter possibilities, moderate repeat penalty since algorithms typically have less necessary repetition than application code. Ideal for implementing sorting algorithms, data structures, etc.
>
> ### Interactive Code (UI, Forms, etc.)
>
> ```plain
> temperature: 0.4
> min_p: 0.05
> top_p: 0.95
> top_k: 0
> repeat_penalty: 1.02
> repeat_last_n: 192
> ```
>
> **Reasoning**: Higher temperature for more creativity in UI solutions, standard filtering, light repeat penalty with extended context to maintain consistency in element naming across a complex interface.
>
> ### Maintenance/Refactoring Code
>
> ```plain
> temperature: 0.1
> min_p: 0.15
> top_p: 0.8
> top_k: 50
> repeat_penalty: 1.0
> repeat_last_n: 512
> ```
>
> **Reasoning**: Extremely low temperature for maximum conservatism when modifying existing code, higher min_p and lower top_p with top_k safety filter to stick very closely to expected patterns, no repeat penalty at all with very long lookback to preserve all naming patterns from existing code.
>
> ### Experimental Alternative: Mirostat Only
>
> ```plain
> temperature: 1.0
> min_p: 0.0
> top_p: 1.0
> top_k: 0
> repeat_penalty: 1.0
> mirostat: 2
> mirostat_tau: 3.0
> mirostat_eta: 0.1
> repeat_last_n: 128
> ```
>
> **Reasoning**: This approach delegates all sampling control to the mirostat algorithm, which dynamically adjusts token selection probabilities to maintain consistent complexity. Can work surprisingly well for code by automatically adapting to different sections.
