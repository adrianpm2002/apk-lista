// Test para verificar el parsing de c4xt6 en TextMode2
import { parseTextMode2 } from './src/utils/textModeParser2.js';

console.log('Testing C9xT0 con 10...');
const result1 = parseTextMode2('C9xT0 con 10', { isLocked: false });
console.log('Result 1:', JSON.stringify(result1, null, 2));

console.log('\nTesting C9xT6, con 10 (with comma)...');
const result2 = parseTextMode2('C9xT6, con 10', { isLocked: false });
console.log('Result 2:', JSON.stringify(result2, null, 2));

console.log('\nTesting C9xD0 con 10...');
const result3 = parseTextMode2('C9xD0 con 10', { isLocked: false });
console.log('Result 3:', JSON.stringify(result3, null, 2));

console.log('\nTesting C9xD6 con 10...');
const result4 = parseTextMode2('C9xD6 con 10', { isLocked: false });
console.log('Result 4:', JSON.stringify(result4, null, 2));

console.log('\nTesting all lines together...');
const allLines = `C9xT0 con 10
C9xT6, con 10 
C9xD0 con 10
C9xD6 con 10`;
const result5 = parseTextMode2(allLines, { isLocked: false });
console.log('Result 5:', JSON.stringify(result5, null, 2));
