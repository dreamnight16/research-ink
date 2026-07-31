import React, { useEffect } from 'react';
import { Workbench } from './core/Workbench';
import { registerPlugin } from './core/pluginRegistry';
import { TermAdvisorPanel } from './plugins/term-advisor/TermAdvisorPanel';
import { LiteraturePanel } from './plugins/literature/LiteraturePanel';
import { EvaluatorPanel } from './plugins/evaluator/EvaluatorPanel';
import { FormulaPanel } from './plugins/formula/FormulaPanel';
import { PaperWriterPanel } from './plugins/paper-writer/PaperWriterPanel';
import { ProjectLabPanel } from './plugins/project-lab/ProjectLabPanel';

export const App: React.FC = () => {
  useEffect(() => {
    registerPlugin({ name: 'term-advisor', displayName: '读懂导师', component: TermAdvisorPanel, icon: 'book' });
    registerPlugin({ name: 'literature', displayName: '追新论文', component: LiteraturePanel, icon: 'search' });
    registerPlugin({ name: 'evaluator', displayName: '审项目', component: EvaluatorPanel, icon: 'check' });
    registerPlugin({ name: 'formula', displayName: '验公式', component: FormulaPanel, icon: 'function' });
    registerPlugin({ name: 'paper-writer', displayName: '写论文', component: PaperWriterPanel, icon: 'edit' });
    registerPlugin({ name: 'project-lab', displayName: '项目实验室', component: ProjectLabPanel, icon: 'flask' });
  }, []);

  return <Workbench />;
};
