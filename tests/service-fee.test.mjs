import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formatServiceFee} from '../src/app/serviceFee.ts';
import {getRecognizedServiceFaq} from '../src/app/serviceFaq.ts';
test('fee wording distinguishes unconfirmed, free, and payable fees without inventing an amount',()=>{
 assert.match(formatServiceFee({fee_description:''}),/Confirm the fee/);
 assert.equal(formatServiceFee({fee_amount:0,fee_description:''}),'Free (no fee)');
 assert.equal(formatServiceFee({fee_amount:75.5,fee_description:'Pay at office.'}),'PHP 75.50 · Pay at office.');
 assert.equal(formatServiceFee({fee_description:'Office-confirmed instructions'}),'Office-confirmed instructions');
 const config={services:[{request_type:'Barangay Clearance',active:true,requirements:'Bring ID',fee_amount:75.5,fee_description:'Pay at office.',processing_time:'Same day',softcopy_available:false}],office:{}};
 assert.match(getRecognizedServiceFaq('Barangay Clearance requirements',config),/PHP 75\.50/);
 assert.match(getRecognizedServiceFaq('What are the fees?',config),/PHP 75\.50/);
});
