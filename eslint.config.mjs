import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs,cjs}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "openai",
              message: "Use lib/ai/executeModelRequest.ts as the unified AI execution gateway.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name='create'][callee.object.property.name='completions'][callee.object.object.property.name='chat']",
          message: "Direct chat completion calls are disallowed. Use lib/ai/executeModelRequest.ts.",
        },
        {
          selector:
            "CallExpression[callee.property.name='create'][callee.object.property.name='embeddings']",
          message: "Direct embedding calls are disallowed. Use lib/ai/executeModelRequest.ts.",
        },
        {
          selector:
            "CallExpression[callee.property.name='create'][callee.object.property.name='transcriptions'][callee.object.object.property.name='audio']",
          message: "Direct transcription calls are disallowed. Use lib/ai/executeModelRequest.ts.",
        },
        {
          selector:
            "CallExpression[callee.property.name='create'][callee.object.property.name='speech'][callee.object.object.property.name='audio']",
          message: "Direct speech calls are disallowed. Use lib/ai/executeModelRequest.ts.",
        },
      ],
    },
  },
  {
    files: ["lib/ai/executeModelRequest.ts"],
    rules: {
      "no-restricted-imports": "off",
      "no-restricted-syntax": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local generated output and recoverable safety artifacts:
    ".next.group*/**",
    ".runtime/**",
    "tmp/**",
    ".tmp*",
    "coverage/**",
    "dist/**",
    "**/*-before",
    "**/*-before/**",
    "**/*.backup",
  ]),
]);

export default eslintConfig;
