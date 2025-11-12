import { execSync } from 'node:child_process';

try {
  execSync('npm run aicp-integrity-ro', { stdio: 'inherit' });
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Smoke test: build + integrity passed');
} catch (err) {
  console.error('❌ Smoke test failed', err);
  process.exit(1);
}
