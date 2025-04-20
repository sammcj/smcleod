// Default values for calculations
var defaultValues = {
    hourlyRate: 250,              // $/hr USD
    manualTime: 2,                // Time taken to manually complete a task in hours
    agenticSetupTime: 0.25,       // Time taken to setup the AI for a task in hours
    guidenceTime: 0.375,          // Time taken to guide/prompt the AI through a task in hours
    agenticProcessingTime: 0.375, // The time it takes for the AI to complete the same task
    tokensUsed: 5,                // Number of tokens (million) used by the AI to complete the task
    overheadFactor: 1.1,          // Overhead factor for management and other costs
    skillMultiplier: 1.0,         // Factor to adjust the skill level of the human
    inputTokenPercentage: 30,     // Percentage of tokens used for input
    cachedTokenPercentage: 88,    // Percentage of tokens that are cached
    tokenCostMultiplier: 1      // Multiplier for token costs (both cached and uncached)
};

// Project size presets
var projectPresets = {
    micro: {
        tokens: 5,                    // million
        manualHours: 3,               // hours to manually complete
        guidenceTime: 0.65,           // hours to guide AI
        agenticProcessingTime: 0.5,   // hours for AI to process
        initialSetupTime: 0.15,       // hours for initial setup
        managementOverheadFactor: 1.0 // overhead factor
    },
    tiny: {
        tokens: 14,
        manualHours: 6,
        guidenceTime: 1,
        agenticProcessingTime: 1.2,
        initialSetupTime: 0.15,
        managementOverheadFactor: 1.0
    },
    extraSmall: {
        tokens: 25,
        manualHours: 24,
        guidenceTime: 2,
        agenticProcessingTime: 1.75,
        initialSetupTime: 0.25,
        managementOverheadFactor: 1.05
    },
    small: {
        tokens: 40,
        manualHours: 70,
        guidenceTime: 3,
        agenticProcessingTime: 3,
        initialSetupTime: 0.5,
        managementOverheadFactor: 1.1
    },
    medium: {
        tokens: 65,
        manualHours: 150,
        guidenceTime: 8,
        agenticProcessingTime: 8,
        initialSetupTime: 1,
        managementOverheadFactor: 1.15
    },
    large: {
        tokens: 120,
        manualHours: 250,
        guidenceTime: 12,
        agenticProcessingTime: 15,
        initialSetupTime: 2,
        managementOverheadFactor: 1.2
    },
    extraLarge: {
        tokens: 200,
        manualHours: 400,
        guidenceTime: 25,
        agenticProcessingTime: 25,
        initialSetupTime: 10,
        managementOverheadFactor: 1.25
    },
    chonky: {
        tokens: 350,
        manualHours: 650,
        guidenceTime: 60,
        agenticProcessingTime: 35,
        initialSetupTime: 25,
        managementOverheadFactor: 1.3
    },
    enterprise: {
        tokens: 500,
        manualHours: 900,
        guidenceTime: 75,
        agenticProcessingTime: 45,
        initialSetupTime: 35,
        managementOverheadFactor: 1.4
    }
};

// Model pricing in USD per 1K tokens
// Last updated 2025-03-21
var modelPricing = {
    claude_3_7_sonnet: {
        inputTokenRate: 0.003,    // uncached tokens input ($3.00 / 1M Tokens)
        outputTokenRate: 0.015,   // uncached tokens output ($15.00 / 1M Tokens)
        cacheWriteRate: 0.00375,  // Higher than input rate (25%) ($3.75 / 1M Tokens)
        cacheReadRate: 0.0003,    // 10% of input rate ($0.30 / 1M Tokens)
        speedMultiplier: 1.0,     // Affects agentic processing time, but not cost
        aiCapabilityFactor: 1.0   // Factor to adjust the AI's capability (0.75 = 25% more tokens used to successfully complete)
    },
    claude_3_5_haiku: {
        inputTokenRate: 0.0008,
        outputTokenRate: 0.004,
        cacheWriteRate: 0.001,
        cacheReadRate: 0.00008,
        inputTokenBatchRate: 0.0005,
        outputTokenBatchRate: 0.0025,
        speedMultiplier: 0.85,
        aiCapabilityFactor: 0.75
    },
    openai_o1: {
        inputTokenRate: 0.015,
        outputTokenRate: 0.06,
        cacheWriteRate: 0.01875,
        cacheReadRate: 0.0075,
        speedMultiplier: 1.5,
        aiCapabilityFactor: 1.0
    },
    openai_o3: {
        inputTokenRate: 0.010,
        outputTokenRate: 0.040,
        cacheWriteRate: 0.01875,
        cacheReadRate: 0.0025,
        speedMultiplier: 1.5,
        aiCapabilityFactor: 1.1
    },
    openai_o3_mini: {
        inputTokenRate: 0.0011,
        outputTokenRate: 0.0044,
        cacheWriteRate: 0.001375,
        cacheReadRate: 0.00055,
        speedMultiplier: 1.3,
        aiCapabilityFactor: 0.9
    },
    deepseek_chat: {
        inputTokenRate: 0.00027,
        outputTokenRate: 0.0011,
        cacheWriteRate: 0.0003375,
        cacheReadRate: 0.00007,
        speedMultiplier: 1.0,
        aiCapabilityFactor: 0.9
    },
    deepseek_r1: {
        inputTokenRate: 0.00014,
        outputTokenRate: 0.00219,
        cacheWriteRate: 0.000175,
        cacheReadRate: 0.00055,
        speedMultiplier: 1.5,
        aiCapabilityFactor: 1.0
    },
    gemini_2_5_pro: {
        inputTokenRate: 0.0025,
        outputTokenRate: 0.015,
        cacheWriteRate: 0.0025, //caching not supported
        cacheReadRate: 0.015,   //caching not supported
        speedMultiplier: 0.9,
        aiCapabilityFactor: 1.0
    }
};
