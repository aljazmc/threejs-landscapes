export default {
    ignore: [".cache", ".git", ".yarn", "coverage", "dist", "node_modules"],
    rules: {
        // each package is versioned on its own, the root package.json too
        packages: [".", "packages/*"],
    },
};
