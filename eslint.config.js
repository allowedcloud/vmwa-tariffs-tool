import antfu from '@antfu/eslint-config'

export default antfu({
  rules: {
    'prefer-const': 'off', // Disable the rule
    // or
    // 'prefer-const': ['warn', { 'destructuring': 'all' }] // Adjust the rule settings
    'vue/max-attributes-per-line': ['error', {
      singleline: {
        max: 1,
      },
      multiline: {
        max: 1,
      },
    }],
    'vue/html-indent': ['error', 2, {
      attribute: 1,
      baseIndent: 1,
      closeBracket: 0,
      alignAttributesVertically: true,
    }],
  },
})
