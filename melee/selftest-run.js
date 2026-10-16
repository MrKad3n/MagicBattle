import { runSelfTests } from './js/selftest.js';

const results = runSelfTests();
let failed = 0;
for (const r of results) {
	const mark = r.pass ? 'PASS' : 'FAIL';
	if (!r.pass) failed++;
	console.log(`${mark}  ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
