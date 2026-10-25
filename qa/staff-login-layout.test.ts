import {describe,it,expect,vi} from 'vitest';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {StaffPortal} from '../web/staff-portal';
describe('staff portal user-facing security boundary',()=>{
 const props={client:undefined,api:vi.fn() as any,language:'en' as const,onReady:vi.fn(),onSignedOut:vi.fn()};
 it('asks guests for provisioned credentials, not a case token or self-selected role',()=>{
  const html=renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(StaffPortal,{...props,active:false})));
  expect(html).toContain('Sign in with your staff account');
  expect(html).toContain('type="email"');
  expect(html).toContain('type="password"');
  expect(html).toContain('There is no public sign-up.');
  expect(html).not.toContain('Role: Reviewer');
  expect(html).not.toContain('My case inbox');
 });
 it('shows a sign-out action and server permission notice for a saved staff session',()=>{
  const html=renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(StaffPortal,{...props,active:true})));
  expect(html).toContain('Sign out securely');
  expect(html).toContain('server verifies your role and case access');
  expect(html).toContain('My case inbox');
 });
});
