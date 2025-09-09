const { parseTextMode } = require('../src/utils/textModeParser');

console.log("=== EJEMPLO CORREGIDO (separadores consistentes) ===");

const inputCorrected = `54,64,08,05,14,82-10-10
54*64*08*05*14*82-5
05,82-10

87,06,12-10-10
87*06*12-10

08,14,15,07,54-10-10
08*14*15*07*54-10
54,82-10


07,17,27,37,47,57,67,77,87,97-8
70,71,72,73,74,75,76,77,78,79-8
00,10,20,30,40,50,60,70,80,90-8
08,18,28,38,48,58,68,78,88,98-8
05,15,25,35,45,55,65,75,85,95-8
60,61,62,63,64,65,66,67,68,69-8
90,91,92,93,94,95,96,97,98,99-8
20,21,22,23,24,25,26,27,28,29-8


08,23,04,92,14,12,94,54,80,57,75,60,35,53-15

60,80-10`;

const resCorrected = parseTextMode(inputCorrected, { isLocked: false });

console.log("ERRORS FOUND:");
if (resCorrected.errors.length === 0) {
  console.log("✅ No errors - all separators are consistent!");
} else {
  resCorrected.errors.forEach(error => {
    console.log(`Line ${error.line}: ${error.message}`);
  });
}

console.log("\nSUMMARY:");
console.log(`Total instructions: ${resCorrected.instructions.length}`);
console.log(`Total errors: ${resCorrected.errors.length}`);
console.log(`Per lottery sum: ${resCorrected.perLotterySum}`);

// Mostrar la línea que fue corregida
console.log("\n=== LÍNEA CORREGIDA ===");
console.log("Antes: 54*64*08*05*14,82-5 (❌ mezcla * y ,)");
console.log("Después: 54*64*08*05*14*82-5 (✅ solo *)");

// Mostrar el parle resultante de la línea 2
const line2Instruction = resCorrected.instructions.find(inst => inst.line === 2);
if (line2Instruction) {
  console.log(`\n=== PARLE GENERADO (línea 2) ===`);
  console.log(`Números base: 54,64,08,05,14,82`);
  console.log(`Combinaciones generadas: ${line2Instruction.numbers.join(', ')}`);
  console.log(`Total combinaciones: ${line2Instruction.numbers.length}`);
  console.log(`Monto por combinación: ${line2Instruction.amountEach}`);
  console.log(`Total por lotería: ${line2Instruction.totalPerLottery}`);
}
