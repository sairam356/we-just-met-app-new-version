// Vercel Function for /api/*. The real code is bundled from server/src/vercel.ts by `npm run build`.
module.exports = require("../server/dist/vercel.cjs").default;
