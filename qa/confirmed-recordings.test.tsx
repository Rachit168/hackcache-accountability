import React from 'react';
import {describe,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {ConfirmedRecordings} from '../web/confirmed-recordings';

describe('confirmed recording layout and actions',()=>{
 const data=[
  {id:'a',name:'citizen-recording.webm',bytes:93001},
  {id:'b',name:'very-long-recording-name-'.repeat(12)+'.ogg',bytes:402},
 ];
 it('shows nothing without recordings',()=>{
  expect(renderToStaticMarkup(<ConfirmedRecordings files={[]} language="en" disabled={false} onRemove={vi.fn()}/>)).toBe('');
 });
 it('shows each file once with size, status and an explicit Remove button',()=>{
  const html=renderToStaticMarkup(<ConfirmedRecordings files={data} language="en" disabled={false} onRemove={vi.fn()}/>);
  expect(html).toContain('Privately uploaded recordings');
  expect(html).toContain('citizen-recording.webm');
  expect(html).toContain('90.8 KiB');
  expect(html).toContain('402 B');
  expect(html.match(/Upload confirmed/g)).toHaveLength(2);
  expect(html.match(/class="danger-button"/g)).toHaveLength(2);
  expect(html).toContain('Remove recording: citizen-recording.webm');
  expect(html).toContain('class="confirmed-recording-details"');
 });
 it('renders filenames as text rather than executable markup',()=>{
  const html=renderToStaticMarkup(<ConfirmedRecordings files={[{id:'a',name:'<script>alert(1)</script>.webm',bytes:9}]} language="en" disabled={false} onRemove={vi.fn()}/>);
  expect(html).toContain('&lt;script&gt;');
  expect(html).not.toContain('<script>');
 });
 it('keeps disabled controls and Hindi labels',()=>{
  const html=renderToStaticMarkup(<ConfirmedRecordings files={data.slice(0,1)} language="hi" disabled={true} onRemove={vi.fn()}/>);
  expect(html).toContain('disabled=""');
  expect(html).toContain('रिकॉर्डिंग हटाएँ');
 });
});
