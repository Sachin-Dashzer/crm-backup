import fs from 'fs';

const filesToScan = [
  'src/components/Sidebars/SalesSidebar.js',
  'src/app/sales/dashboard/page.jsx',
  'src/app/sales/revenue/page.jsx',
  'src/app/api/transactions/get-all/route.js',
  'src/app/sales/transactions/page.js',
  'src/app/sales/employees/page.jsx',
  'src/app/sales/employees/add-employee/page.jsx',
  'src/app/sales/employees/update/[id]/page.jsx',
  'src/app/api/employees/create/route.js',
  'src/app/api/employees/update/[id]/route.js',
  'src/app/sales/agents/page.jsx',
];

const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F1E6}-\u{1F1FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/u;

let hasEmoji = false;

for (const file of filesToScan) {
  if (!fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (emojiRegex.test(line)) {
      console.log(`EMOJI FOUND in ${file} at line ${idx + 1}: ${line}`);
      hasEmoji = true;
    }
  });
}

if (!hasEmoji) {
  console.log('Zero emojis found across all scanned files! 100% clean.');
}
