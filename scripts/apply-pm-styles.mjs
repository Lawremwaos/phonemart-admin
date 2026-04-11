/**
 * One-off bulk replace for PHONEMART shared UI classes.
 * Run: node scripts/apply-pm-styles.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const targets = ["src/pages", "src/components"].map((d) => path.join(root, d));

/** @type {Array<[RegExp, string]>} — longer / more specific patterns first */
const pairs = [
  [/className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-\[80vh\] overflow-y-auto"/g, 'className="pm-modal-panel max-w-lg w-full max-h-[80vh] overflow-y-auto"'],
  [/className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6"/g, 'className="pm-modal-panel w-full max-w-2xl p-6"'],
  [/className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"/g, 'className="pm-modal-panel max-w-md w-full p-6"'],
  [/className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-\[90vh\] overflow-y-auto"/g, 'className="pm-modal-panel max-w-2xl w-full max-h-[90vh] overflow-y-auto"'],

  [/className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full"/g, 'className="pm-card pm-pad-xl max-w-md w-full"'],
  [/className="bg-white p-6 rounded-lg shadow mb-6"/g, 'className="pm-card pm-pad-lg mb-6"'],
  [/className="bg-white p-6 rounded-lg shadow-lg mb-6"/g, 'className="pm-card pm-pad-lg mb-6"'],
  [/className="bg-white p-6 rounded-lg shadow"/g, 'className="pm-card pm-pad-lg"'],
  [/className="bg-white p-5 rounded-lg shadow mb-6"/g, 'className="pm-card pm-pad-lg mb-6"'],
  [/className="bg-white p-5 rounded-lg shadow"/g, 'className="pm-card pm-pad-lg"'],
  [/className="bg-white p-4 rounded-lg shadow mb-6"/g, 'className="pm-card pm-pad mb-6"'],
  [/className="bg-white p-4 rounded-lg shadow"/g, 'className="pm-card pm-pad"'],
  [/className="bg-white rounded-lg shadow overflow-x-auto"/g, 'className="pm-table-shell"'],
  [/className="bg-white rounded-lg shadow overflow-hidden"/g, 'className="pm-card pm-pad-0 overflow-hidden"'],
  [/className="bg-white rounded-lg shadow p-4 border text-center"/g, 'className="pm-card pm-pad text-center border border-slate-200/80"'],
  [/className="bg-white rounded-lg shadow p-4 border"/g, 'className="pm-card pm-pad border border-slate-200/80"'],
  [/className="bg-white rounded-lg shadow p-4"/g, 'className="pm-card pm-pad"'],
  [/className="bg-white rounded-lg shadow p-5 border space-y-4"/g, 'className="pm-card pm-pad-lg border border-slate-200/80 space-y-4"'],

  [/className="bg-white rounded shadow overflow-x-auto"/g, 'className="pm-table-shell"'],
  [/className="bg-white rounded shadow overflow-hidden"/g, 'className="pm-card pm-pad-0 overflow-hidden"'],
  [/className="bg-white rounded shadow mb-6"/g, 'className="pm-card pm-pad mb-6"'],
  [/className="bg-white rounded shadow mt-6 p-4"/g, 'className="pm-card pm-pad mt-6"'],
  [/className="bg-white rounded shadow mt-6"/g, 'className="pm-card pm-pad mt-6"'],
  [/className="bg-white rounded shadow p-4"/g, 'className="pm-card pm-pad"'],
  [/className="bg-white rounded shadow"/g, 'className="pm-card pm-pad"'],

  [/className="block text-sm font-medium text-gray-700 mb-2"/g, 'className="pm-label"'],
  [/className="block text-sm font-medium text-gray-700 mb-1"/g, 'className="pm-label mb-1"'],

  [/className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"/g, 'className="pm-input"'],
  [/className="w-full border border-gray-300 rounded-md px-3 py-2"/g, 'className="pm-input"'],
  [/className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white"/g, 'className="pm-input"'],

  [/className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"/g, 'className="pm-btn pm-btn-primary"'],
  [/className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"/g, 'className="pm-btn pm-btn-primary"'],
  [/className="bg-blue-600 text-white px-4 py-2 rounded-md"/g, 'className="pm-btn pm-btn-primary"'],
  [/className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700"/g, 'className="pm-btn pm-btn-success pm-btn-sm"'],
  [/className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700"/g, 'className="pm-btn pm-btn-danger pm-btn-sm"'],

  [/className="bg-white p-8 rounded shadow text-center"/g, 'className="pm-card pm-pad-xl text-center"'],
  [/className="bg-white p-6 rounded shadow text-center"/g, 'className="pm-card pm-pad-lg text-center"'],
  [/className="bg-white p-6 rounded shadow mb-6"/g, 'className="pm-card pm-pad-lg mb-6"'],
  [/className="bg-white p-6 rounded shadow"/g, 'className="pm-card pm-pad-lg"'],
  [/className="bg-white p-4 rounded shadow mb-6"/g, 'className="pm-card pm-pad mb-6"'],
  [/className="bg-white p-4 rounded shadow border-l-4 border-orange-500"/g, 'className="pm-card pm-pad border-l-4 border-orange-500"'],
  [/className="bg-white p-4 rounded shadow border-l-4 border-blue-500"/g, 'className="pm-card pm-pad border-l-4 border-blue-500"'],
  [/className="bg-white p-4 rounded shadow border-l-4 border-emerald-500"/g, 'className="pm-card pm-pad border-l-4 border-emerald-500"'],
  [/className="bg-white p-4 rounded shadow border-l-4 border-purple-500"/g, 'className="pm-card pm-pad border-l-4 border-purple-500"'],
  [/className="bg-white p-4 rounded shadow border-l-4 border-red-500"/g, 'className="pm-card pm-pad border-l-4 border-red-500"'],
  [/className="bg-white p-5 rounded-lg shadow border-l-4 border-blue-500"/g, 'className="pm-card pm-pad-lg border-l-4 border-blue-500"'],
  [/className="bg-white p-5 rounded-lg shadow border-l-4 border-purple-500"/g, 'className="pm-card pm-pad-lg border-l-4 border-purple-500"'],
  [/className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500"/g, 'className="pm-card pm-pad border-l-4 border-green-500"'],
  [/className="bg-white p-4 rounded-lg shadow border-l-4 border-red-500"/g, 'className="pm-card pm-pad border-l-4 border-red-500"'],

  [/className="border border-gray-300 rounded-md px-3 py-2 w-full pr-10"/g, 'className="pm-input pr-10"'],
  [/className="border border-gray-300 rounded-md px-3 py-2 w-full text-sm"/g, 'className="pm-input text-sm"'],
  [/className="border border-gray-300 rounded-md px-3 py-2 w-full uppercase"/g, 'className="pm-input uppercase"'],
  [/className="border border-gray-300 rounded-md px-3 py-2 w-full"/g, 'className="pm-input"'],
  [/className="border border-gray-300 rounded-md px-2 py-1 w-full text-sm"/g, 'className="pm-input py-1.5 text-sm"'],

  [/className="border border-gray-300 rounded-md px-3 py-2 bg-white"/g, 'className="pm-input"'],
  [/className="bg-white p-8 rounded-lg shadow-lg max-w-2xl"/g, 'className="pm-modal-panel pm-pad-xl max-w-2xl"'],

  [/className="bg-white p-4 rounded shadow"/g, 'className="pm-card pm-pad"'],
  [/className="bg-white p-8 rounded shadow border border-gray-200 text-center text-gray-600"/g, 'className="pm-card pm-pad-xl border border-slate-200 text-center text-slate-600"'],
  [/className="bg-white p-6 rounded shadow border-2 border-blue-200"/g, 'className="pm-card pm-pad-lg border-2 border-teal-200/80"'],
  [/className="bg-white p-6 rounded shadow border border-gray-200"/g, 'className="pm-card pm-pad-lg border border-slate-200"'],
  [/className="bg-white p-6 rounded shadow border border-purple-200"/g, 'className="pm-card pm-pad-lg border border-purple-200/80"'],
  [/className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4"/g, 'className="pm-modal-panel pm-pad-lg max-w-md w-full mx-4"'],
  [/className="bg-white p-8 rounded-lg shadow-lg text-center"/g, 'className="pm-modal-panel pm-pad-xl text-center"'],
  [/className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500"/g, 'className="pm-card pm-pad border-l-4 border-blue-500"'],
  [/className="bg-white p-4 rounded-lg shadow border-l-4 border-purple-500"/g, 'className="pm-card pm-pad border-l-4 border-purple-500"'],

  [/className="w-full border border-gray-300 rounded px-3 py-2"/g, 'className="pm-input"'],
  [/className="border border-gray-300 rounded px-3 py-2 text-sm w-40"/g, 'className="pm-input text-sm !w-40 max-w-none"'],
  [/className="border border-gray-300 rounded-md px-3 py-2"/g, 'className="pm-input pm-input-narrow"'],

  [
    /className="w-full border-2 border-gray-300 rounded-md px-3 py-2 bg-white text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"/g,
    'className="pm-input"',
  ],
  [
    /className="w-full border-2 border-gray-300 rounded-md px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"/g,
    'className="pm-input"',
  ],

  [/className="border border-gray-300 rounded px-3 py-2 text-sm"/g, 'className="pm-input text-sm"'],
  [/className="flex-1 border border-gray-300 rounded-md px-3 py-2"/g, 'className="pm-input flex-1 min-w-0"'],
  [/className="bg-white p-6 rounded shadow space-y-4"/g, 'className="pm-card pm-pad-lg space-y-4"'],
  [/className="bg-white p-4 rounded-lg shadow mb-4 border border-gray-200"/g, 'className="pm-card pm-pad mb-4 border border-slate-200"'],
  [/className="w-full border border-gray-300 rounded-md px-3 py-2 mt-2"/g, 'className="pm-input mt-2"'],
  [/className="w-full border border-gray-300 rounded px-2 py-1 text-sm"/g, 'className="pm-input py-1.5 text-sm"'],
  [
    /className="w-full border border-gray-300 text-gray-800 px-4 py-2 rounded font-medium hover:bg-gray-50"/g,
    'className="pm-btn pm-btn-secondary w-full font-medium text-gray-800"',
  ],
  [/className="border border-gray-300 rounded-md px-3 py-2 w-full mb-2"/g, 'className="pm-input mb-2"'],
  [/className="border border-gray-300 rounded-md px-3 py-2 w-full max-w-md"/g, 'className="pm-input max-w-md"'],
  [/className="border border-gray-300 rounded-md px-2 py-1.5 w-full text-sm"/g, 'className="pm-input py-1.5 text-sm"'],
  [
    /className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md p-3 shadow-lg z-10"/g,
    'className="absolute left-0 right-0 top-full z-10 mt-1 pm-card pm-pad shadow-lg"',
  ],
  [/className="bg-white p-8 max-w-md mx-auto shadow-lg"/g, 'className="pm-card pm-pad-xl max-w-md mx-auto shadow-lg"'],
];

function processFile(filePath) {
  let s = fs.readFileSync(filePath, "utf8");
  const before = s;
  for (const [re, rep] of pairs) {
    s = s.replace(re, rep);
  }
  if (s !== before) {
    fs.writeFileSync(filePath, s);
    return true;
  }
  return false;
}

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

let n = 0;
for (const dir of targets) {
  for (const f of walk(dir)) {
    if (processFile(f)) {
      console.log("updated", path.relative(root, f));
      n++;
    }
  }
}
console.log(`Done. ${n} files changed.`);
