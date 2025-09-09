const { parseTextMode } = require('../src/utils/textModeParser');

console.log("=== TESTING EXISTING FUNCTIONALITY STILL WORKS ===");

// Test cases que deberían seguir funcionando
const testCases = [
  {
    name: "Fijo/corrido con espacios",
    input: "12 25 -5-3",
    shouldHaveErrors: false
  },
  {
    name: "Fijo/corrido con comas",
    input: "12,25-5-3",
    shouldHaveErrors: false
  },
  {
    name: "Parle combinatorio con asteriscos",
    input: "12*25*30-90",
    shouldHaveErrors: false
  },
  {
    name: "Centenas",
    input: "123 555-20",
    shouldHaveErrors: false
  },
  {
    name: "Separadores mixtos (NUEVO ERROR)",
    input: "12,25*30-90",
    shouldHaveErrors: true
  },
  {
    name: "Separadores mixtos espacios y comas",
    input: "12 25,30-90",
    shouldHaveErrors: true
  }
];

testCases.forEach((testCase, index) => {
  console.log(`\n--- Test ${index + 1}: ${testCase.name} ---`);
  console.log(`Input: ${testCase.input}`);
  
  const result = parseTextMode(testCase.input, { isLocked: false });
  
  const hasErrors = result.errors.length > 0;
  const passed = hasErrors === testCase.shouldHaveErrors;
  
  console.log(`Expected errors: ${testCase.shouldHaveErrors ? 'YES' : 'NO'}`);
  console.log(`Actual errors: ${hasErrors ? 'YES' : 'NO'} (${result.errors.length})`);
  console.log(`Test result: ${passed ? '✅ PASS' : '❌ FAIL'}`);
  
  if (hasErrors) {
    result.errors.forEach(error => {
      console.log(`  Error line ${error.line}: ${error.message}`);
    });
  } else {
    console.log(`  Instructions generated: ${result.instructions.length}`);
    console.log(`  Per lottery sum: ${result.perLotterySum}`);
  }
});

console.log("\n=== SUMMARY ===");
console.log("All tests completed. Check for any FAIL results above.");
