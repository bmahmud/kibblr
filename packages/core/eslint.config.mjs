import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules/**'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      // core must stay runnable without a device: no RN or Firebase.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react-native', 'react-native/*', 'expo', 'expo-*'], message: 'packages/core must not import React Native or Expo.' },
            { group: ['firebase', 'firebase/*', '@firebase/*'], message: 'packages/core must not import Firebase.' },
          ],
        },
      ],
    },
  },
);
