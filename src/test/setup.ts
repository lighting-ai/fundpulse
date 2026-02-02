// Vitest 测试环境配置
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// 每个测试后清理 DOM
afterEach(() => {
  cleanup();
});
