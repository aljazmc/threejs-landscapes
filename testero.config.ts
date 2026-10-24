/** Runs this project's tests like jest.config.ts did. */
export default {
    ignore: [".cache", ".git", ".yarn", "coverage", "dist", "node_modules"],
    rules: {
        clearMocks: true,
        // no package has tests yet
        passWithNoTests: true,
    },
};
