import './styles/theme.css';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyStoredTransparency } from './shared/transparency';

// 在渲染前应用用户偏好，避免覆盖层先以 Acrylic 出现再切换
applyStoredTransparency();

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
