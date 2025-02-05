const CUDA_SIZE = 500 * 1024 * 1024; // 500 MB base CUDA overhead

const calculateMemoryBreakdown = (config) => {
  const { numParams, contextSize, bitsPerWeight, kvCacheType } = config;
  const baseModelSize = (numParams * 1e9 * bitsPerWeight) / 8;
  const hiddenSize = Math.sqrt(numParams * 1e9 / 12);
  const numLayers = Math.round(numParams * 1e9 / (12 * hiddenSize * hiddenSize));

  let kvCacheBits = 16;
  if (kvCacheType === 'Q8_0') kvCacheBits = 8;
  if (kvCacheType === 'Q4_0') kvCacheBits = 4;

  const kvCacheSize = contextSize * 2 * numLayers * hiddenSize * (kvCacheBits / 8);
  const attentionOverhead = contextSize * hiddenSize * 3 * (bitsPerWeight / 8);

  return {
    modelSize: (baseModelSize + CUDA_SIZE) / (1024 * 1024 * 1024),
    kvCacheSize: (kvCacheSize + attentionOverhead) / (1024 * 1024 * 1024)
  };
};

const Select = ({ label, value, onChange, options }) => {
  return React.createElement('div', { className: 'flex flex-col gap-2' },
    React.createElement('label', {
      className: 'text-sm font-medium text-gray-700 dark:text-gray-300'
    }, label),
    React.createElement('select', {
      value,
      onChange,
      className: 'w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white'
    }, options.map(([value, label]) =>
      React.createElement('option', { key: value, value }, label)
    ))
  );
};

const Slider = ({ label, value, onChange, min, max, step }) => {
  return React.createElement('div', { className: 'flex flex-col gap-2' },
    React.createElement('div', { className: 'flex justify-between items-center' },
      React.createElement('label', {
        className: 'text-sm font-medium text-gray-700 dark:text-gray-300'
      }, label),
      React.createElement('span', {
        className: 'text-sm text-gray-600 dark:text-gray-400'
      }, `${value}${label.includes('Model') ? 'B' : 'K'}`)
    ),
    React.createElement('input', {
      type: 'range',
      min,
      max,
      step,
      value,
      onChange: (e) => onChange(Number(e.target.value)),
      className: 'w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600 dark:accent-blue-400'
    })
  );
};

const ToggleButton = ({ label, value, onChange }) => {
  return React.createElement('button', {
    onClick: () => onChange(!value),
    className: `flex items-center space-x-2 text-sm font-medium ${value ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`
  },
    React.createElement('div', {
      className: `w-9 h-5 rounded-full transition-colors duration-200 ${value ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'} relative`
    },
      React.createElement('div', {
        className: `w-4 h-4 rounded-full bg-white absolute top-0.5 left-0.5 transition-transform duration-200 ${value ? 'transform translate-x-4' : ''}`
      })
    ),
    React.createElement('span', null, label)
  );
};

const MemoryBar = ({ label, modelMemory, kvCacheMemory, maxMemory, colors }) => {
  const totalMemory = modelMemory + kvCacheMemory;
  const modelPercentage = (modelMemory / maxMemory) * 100;
  const kvCachePercentage = (kvCacheMemory / maxMemory) * 100;

  return React.createElement('div', { className: 'space-y-2' },
    React.createElement('div', { className: 'flex justify-between items-center' },
      React.createElement('span', {
        className: 'font-medium text-gray-900 dark:text-white'
      }, label),
      React.createElement('div', {
        className: 'text-sm space-x-4 text-gray-600 dark:text-gray-300'
      },
        React.createElement('span', null, `Model: ${modelMemory.toFixed(1)} GB`),
        React.createElement('span', null, `K/V: ${kvCacheMemory.toFixed(1)} GB`),
        React.createElement('span', {
          className: 'font-semibold'
        }, `Total: ${totalMemory.toFixed(1)} GB`)
      )
    ),
    React.createElement('div', {
      className: 'h-6 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden flex'
    },
      React.createElement('div', {
        className: `h-full ${colors.model} transition-all duration-300`,
        style: { width: `${modelPercentage}%` }
      }),
      React.createElement('div', {
        className: `h-full ${colors.kvCache} transition-all duration-300`,
        style: { width: `${kvCachePercentage}%` }
      })
    )
  );
};

const VRAMCalculator = () => {
  const [config, setConfig] = React.useState({
    numParams: 14,
    contextSize: 65536,
    bitsPerWeight: 4.83,
  });

  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const [memoryBreakdown, setMemoryBreakdown] = React.useState({
    fp16: { modelSize: 0, kvCacheSize: 0 },
    q8_0: { modelSize: 0, kvCacheSize: 0 },
    q4_0: { modelSize: 0, kvCacheSize: 0 }
  });

  React.useEffect(() => {
    const fp16 = calculateMemoryBreakdown({ ...config, kvCacheType: 'FP16' });
    const q8_0 = calculateMemoryBreakdown({ ...config, kvCacheType: 'Q8_0' });
    const q4_0 = calculateMemoryBreakdown({ ...config, kvCacheType: 'Q4_0' });

    setMemoryBreakdown({ fp16, q8_0, q4_0 });
  }, [config]);

  const maxMemory = Math.max(
    memoryBreakdown.fp16.modelSize + memoryBreakdown.fp16.kvCacheSize,
    24
  );

  const modelSizes = [
    [1.5, '1.5B parameters'],
    [3.8, '3.8B parameters'],
    [7, '7B parameters'],
    [8, '8B parameters'],
    [14, '14B parameters'],
    [22, '22B parameters'],
    [24, '24B parameters'],
    [32, '32B parameters'],
    [70, '70B parameters'],
    [72, '72B parameters'],
    [90, '90B parameters'],
    [110, '110B parameters'],
    [671, '671B parameters']
  ];

  const contextSizes = [
    [4096, '4K tokens'],
    [8192, '8K tokens'],
    [16384, '16K tokens'],
    [32768, '32K tokens'],
    [49152, '48K tokens'],
    [65536, '64K tokens'],
    [98304, '96K tokens'],
    [131072, '128K tokens'],
    [262144, '256K tokens']
  ];

  // IQ1_S 	1.78
  // IQ2_XXS 2.20
  // IQ2_XS 	2.43
  // IQ2_S 	2.55
  // IQ2_M 	2.76
  // Q2_K_S 	2.79
  // Q2_K 	  3.00
  // IQ3_XXS 3.21
  // IQ3_XS 	3.32
  // Q3_K_S 	3.50
  // IQ3_S 	3.52
  // IQ3_M 	3.63
  // Q3_K_M 	3.89
  // Q3_K_L 	4.22
  // IQ4_XS 	4.32
  // IQ4_NL 	4.56
  // Q4_K_S 	4.57
  // Q4_K_M 	4.83
  // Q5_K_S 	5.52
  // Q5_K_M 	5.67
  // Q6_K 	  6.57

  const quantizationLevels = [
    [16, 'F16/FP16 (16.00)'],
    [8.50, 'Q8_0 (8.50)'],
    [6.57, 'Q6_K (6.57)'],
    [5.67, 'Q5_K_M (5.67)'],
    [4.56, 'IQ4_NL (4.56)'],
    [4.83, 'Q4_K_M (4.83)'],
    [4.32, 'IQ4_XS (4.32)'],
    [4.22, 'Q3_K_L (4.22)'],
    [4.00, 'Q4_0 (4.00) (Legacy!)'],
    [3.66, 'IQ3_M (3.66)'],
    [3.50, 'Q3_K_S (3.50)'],
    [3.32, 'IQ3_XS (3.32)'],
    [3.00, 'Q2_K (3.00)'],
    [2.76, 'IQ2_M (2.76)'],
  ];

  const renderControls = () => {
    if (showAdvanced) {
      return React.createElement('div', { className: 'space-y-6' },
        React.createElement(Slider, {
          label: 'Model Size',
          value: config.numParams,
          onChange: (value) => setConfig(prev => ({ ...prev, numParams: value })),
          min: 1,
          max: 671,
          step: 0.1
        }),
        React.createElement(Slider, {
          label: 'Context Size',
          value: config.contextSize / 1024, // Convert to K
          onChange: (value) => setConfig(prev => ({ ...prev, contextSize: value * 1024 })),
          min: 1,
          max: 256,
          step: 1
        })
      );
    }

    return React.createElement('div', {
      className: 'grid grid-cols-1 md:grid-cols-2 gap-6'
    },
      React.createElement(Select, {
        label: 'Model Size',
        value: config.numParams,
        onChange: (e) => setConfig(prev => ({ ...prev, numParams: Number(e.target.value) })),
        options: modelSizes
      }),
      React.createElement(Select, {
        label: 'Context Size',
        value: config.contextSize,
        onChange: (e) => setConfig(prev => ({ ...prev, contextSize: Number(e.target.value) })),
        options: contextSizes
      })
    );
  };

  return React.createElement('div', {
    className: 'vram-calculator max-w-3xl mx-auto rounded-xl shadow-lg bg-white dark:bg-gray-800 p-6 space-y-6'
  },
    React.createElement('div', {
      className: 'flex justify-between items-center'
    },
      React.createElement('h4', {
        className: 'text-xl font-bold text-gray-900 dark:text-white'
      }, 'VRAM Usage Estimator'),
      React.createElement(ToggleButton, {
        label: 'Advanced',
        value: showAdvanced,
        onChange: setShowAdvanced
      })
    ),

    renderControls(),

    React.createElement(Select, {
      label: 'Quantization Level (bpw)',
      value: config.bitsPerWeight,
      onChange: (e) => setConfig(prev => ({ ...prev, bitsPerWeight: Number(e.target.value) })),
      options: quantizationLevels
    }),

    React.createElement('div', { className: 'space-y-6 mt-6' },
      React.createElement(MemoryBar, {
        label: 'FP16 K/V Cache',
        modelMemory: memoryBreakdown.fp16.modelSize,
        kvCacheMemory: memoryBreakdown.fp16.kvCacheSize,
        maxMemory,
        colors: {
          model: 'bg-blue-600 dark:bg-blue-700',
          kvCache: 'bg-blue-400 dark:bg-blue-500'
        }
      }),
      React.createElement(MemoryBar, {
        label: 'Q8_0 K/V Cache',
        modelMemory: memoryBreakdown.q8_0.modelSize,
        kvCacheMemory: memoryBreakdown.q8_0.kvCacheSize,
        maxMemory,
        colors: {
          model: 'bg-green-600 dark:bg-green-700',
          kvCache: 'bg-green-400 dark:bg-green-500'
        }
      }),
      React.createElement(MemoryBar, {
        label: 'Q4_0 K/V Cache',
        modelMemory: memoryBreakdown.q4_0.modelSize,
        kvCacheMemory: memoryBreakdown.q4_0.kvCacheSize,
        maxMemory,
        colors: {
          model: 'bg-purple-600 dark:bg-purple-700',
          kvCache: 'bg-purple-400 dark:bg-purple-500'
        }
      })
    )
  );
};

window.initVRAMCalculator = function (container) {
  ReactDOM.render(React.createElement(VRAMCalculator), container);
};
