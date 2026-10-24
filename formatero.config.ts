/** Formats this project. */
export default {
    ignore: [
        ".cache",
        ".git",
        ".yarn",
        "coverage",
        "dist",
        "node_modules",
        "yarn.lock",
        "*.tsbuildinfo",
    ],
    rules: {
        includes: [
            "**",
            "!**/dist",
            "!**/*.js",
            "!**/*.jsx",
            "!**/*.cjs",
            "!**/*.mjs",
            "!coverage",
        ],
        attributePosition: "auto",
        bracketSpacing: true,
        formatWithErrors: false,
        indentStyle: "space",
        indentWidth: 4,
        lineEnding: "lf",
        lineWidth: 80,
        javascript: {
            arrowParentheses: "always",
            bracketSameLine: false,
            jsxQuoteStyle: "double",
            quoteProperties: "asNeeded",
            quoteStyle: "double",
            semicolons: "always",
            trailingCommas: "all",
        },
        json: {
            trailingCommas: "none",
        },
    },
};
