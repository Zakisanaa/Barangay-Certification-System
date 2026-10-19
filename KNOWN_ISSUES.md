# Current limitations

Review date: 19 October 2026. Packaging does not change application behavior.

1. Fee correction supports original paid receipts; an incorrect exemption or waiver cannot currently be voided, and it blocks a replacement payment.
2. Public text, official-list and staff-access drafts do not all trigger an unsaved-change warning when navigating away.
3. The fee suggested for an existing booking comes from the current service catalog. An immutable copy of the fee quoted at booking is not stored.
4. Completing a request does not require the fee/exemption and certificate-register entries to have been recorded. Those office records can be entered later.
5. The existing live deployment had an active service named test with no confirmed fee and 20 of 22 active services without processing times. These are live configuration gaps; production records are not included in this source archive.

The last full project verification passed 135 automated tests and 342 isolated browser checks. These checks do not certify that all edge cases are resolved. The school source package is separately checked for TypeScript validity, test execution and a production build before archiving.
