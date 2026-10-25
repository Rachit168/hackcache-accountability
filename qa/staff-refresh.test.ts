import {it,expect} from 'vitest';
import {nextStaffSessionRevision} from '../web/staff-portal';
import {readFileSync} from 'node:fs';
it('rotates the workspace identity on each new staff authentication',()=>{
 const first=nextStaffSessionRevision(0),second=nextStaffSessionRevision(first);
 expect(first).toBe(1);expect(second).toBe(2);expect(second).not.toBe(first);
 const source=readFileSync(new URL('../web/staff-portal.tsx',import.meta.url),'utf8');
 expect(source).toContain('setRevision(nextStaffSessionRevision)');
 expect(source).toContain('<WorkflowWorkspace key={revision}');
});
