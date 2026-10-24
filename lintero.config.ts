/** Lints this project with the recommended rules, less a few. */
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
        preset: "recommended",
        // three.js elements, like <mesh onClick>, are not DOM elements
        a11y: {
            useKeyWithClickEvents: "off",
        },
        correctness: {
            noUnusedFunctionParameters: "off",
            noUnusedImports: "off",
        },
        style: {
            noNonNullAssertion: "off",
        },
        suspicious: {
            noAssignInExpressions: "off",
        },
    },
};
