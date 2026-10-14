import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, FileText, Loader2, Mail, Upload, X } from "lucide-react";
import { getCertificateTemplates } from "../certificateTemplates";
import { getResidentProfile } from "../residentAuth";
import { getCertificateTemplateFile } from "../portalData";
import type { AppointmentRequest } from "../portalData";

const MAX_PDF_SIZE = 5 * 1024 * 1024;
const DOCX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5e8d70] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export default function CertificateDelivery({ request, onSend, sending }: {
  request: AppointmentRequest;
  onSend: (templateName: string, pdfBase64: string, deliveryId: string) => Promise<void>;
  sending: boolean;
}) {
  const templates = getCertificateTemplates(request.requestType);
  const [selectedTemplate, setSelectedTemplate] = useState(templates.length === 1 ? templates[0].fileName : "");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [loadingRecipient, setLoadingRecipient] = useState(true);
  const [recipientError, setRecipientError] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [checkingPdf, setCheckingPdf] = useState(false);
  const [preparingEmail, setPreparingEmail] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [sent, setSent] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const selectionVersion = useRef(0);
  const sendInProgress = useRef(false);
  const deliveryId = useRef(crypto.randomUUID());
  const canSend = request.status === "APPROVED" || request.status === "COMPLETED";
  const busy = sending || preparingEmail;

  useEffect(() => {
    let active = true;
    setLoadingRecipient(true);
    setRecipientEmail("");
    setRecipientError("");
    void getResidentProfile(request.ownerId).then(
      (profile) => {
        if (!active) return;
        setRecipientEmail(profile.email);
        if (!profile.email) setRecipientError("This resident has no registered email address.");
      },
      (error: unknown) => {
        if (active) setRecipientError(error instanceof Error ? error.message : "Could not load the resident's email address.");
      },
    ).finally(() => { if (active) setLoadingRecipient(false); });
    return () => { active = false; };
  }, [request.ownerId]);

  useEffect(() => {
    if (!pdf) {
      setPdfUrl("");
      return;
    }
    const url = URL.createObjectURL(pdf);
    setPdfUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pdf]);

  useEffect(() => () => { selectionVersion.current += 1; }, []);

  const clearPdf = () => {
    deliveryId.current = crypto.randomUUID();
    selectionVersion.current += 1;
    setPdf(null);
    setPdfUrl("");
    setPdfError("");
    setCheckingPdf(false);
    setSent(false);
    if (fileInput.current) fileInput.current.value = "";
  };

  const downloadTemplate = async () => {
    if (!selectedTemplate || downloading) return;
    setDownloading(true);
    setDownloadError("");
    try {
      const bytes = await getCertificateTemplateFile(selectedTemplate);
      const url = URL.createObjectURL(new Blob([bytes], { type: DOCX_CONTENT_TYPE }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = selectedTemplate;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Could not download the original DOCX. Try again.");
    } finally {
      setDownloading(false);
    }
  };

  const selectPdf = async (file: File | undefined) => {
    if (!file) return;
    clearPdf();
    const version = selectionVersion.current;
    setCheckingPdf(true);
    try {
      if (file.size > MAX_PDF_SIZE) throw new Error("Choose a PDF that is 5 MB or smaller.");
      const header = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer());
      if (file.size < 6 || header !== "%PDF-") {
        throw new Error("Choose a valid PDF file exported from the completed certificate.");
      }
      if (version === selectionVersion.current) setPdf(file);
    } catch (error) {
      if (version === selectionVersion.current) {
        setPdfError(error instanceof Error ? error.message : "Could not read the PDF. Choose the file again.");
      }
    } finally {
      if (version === selectionVersion.current) setCheckingPdf(false);
    }
  };

  const sendPdf = async () => {
    if (!pdf || !selectedTemplate || !canSend || !recipientEmail || busy || sent || sendInProgress.current) return;
    sendInProgress.current = true;
    setPreparingEmail(true);
    setPdfError("");
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result !== "string") {
            reject(new Error("Could not prepare the PDF attachment."));
            return;
          }
          resolve(reader.result.slice(reader.result.indexOf(",") + 1));
        };
        reader.onerror = () => reject(reader.error ?? new Error("Could not read the PDF attachment."));
        reader.readAsDataURL(pdf);
      });
      await onSend(selectedTemplate, base64, deliveryId.current);
      setSent(true);
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : "Could not email the certificate PDF. Try again.");
    } finally {
      sendInProgress.current = false;
      setPreparingEmail(false);
    }
  };

  return (
    <section className="space-y-4 border-t border-[#e3e8e3] pt-5" aria-label="Certificate delivery">
      <div>
        <h3 className="text-base font-bold text-[#122d1f]">Certificate delivery</h3>
        <p className="mt-1 text-sm leading-relaxed text-[#53645b]">
          Download the form, complete it in Word, and upload the finished PDF to email to the resident.
        </p>
      </div>
      {templates.length ? (
        <>
          <div className="space-y-3 rounded-lg border border-[#d9e2da] bg-[#f7faf7] p-4">
            <h4 className="flex items-center gap-2 text-sm font-bold text-[#122d1f]">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e1eae3] text-xs">1</span>
              Download original form
            </h4>
            <label className="block space-y-1.5 text-sm font-semibold text-[#34483a]">
              Certificate template
              <select
                value={selectedTemplate}
                disabled={busy || downloading || checkingPdf}
                onChange={(event) => {
                  setSelectedTemplate(event.target.value);
                  setDownloadError("");
                  clearPdf();
                }}
                className="block min-h-11 w-full rounded-md border border-[#c9d1ca] bg-white px-3 text-sm font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5e8d70] disabled:opacity-50"
              >
                <option value="" disabled>Select a template</option>
                {templates.map((template) => (
                  <option key={template.fileName} value={template.fileName}>{template.label}</option>
                ))}
              </select>
            </label>
            <p className="text-sm leading-relaxed text-[#53645b]">Complete the DOCX in Word, then export it as a PDF.</p>
            <button
              type="button"
              onClick={() => { void downloadTemplate(); }}
              disabled={!selectedTemplate || downloading || busy}
              className={`${buttonClass} w-full border border-[#c9d1ca] bg-white text-[#123323] hover:bg-[#edf5ee] sm:w-auto`}
            >
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {downloading ? "Downloading…" : "Download original DOCX"}
            </button>
            {downloadError && <p role="alert" className="text-sm text-red-800">{downloadError}</p>}
          </div>

          <div className="space-y-3 rounded-lg border border-[#d9e2da] bg-white p-4">
            <h4 className="flex items-center gap-2 text-sm font-bold text-[#122d1f]">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e1eae3] text-xs">2</span>
              Upload and email completed PDF
            </h4>
            <div className="flex items-start gap-2 rounded-md bg-[#f0f5f1] p-3">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#53645b]" />
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-[#34483a]">Resident's registered email</p>
                <p className="mt-0.5 break-all text-[#53645b]">
                  {loadingRecipient ? "Loading email address…" : recipientEmail || "Email unavailable"}
                </p>
              </div>
            </div>
            {recipientError && <p role="alert" className="text-sm text-red-800">{recipientError}</p>}
            {!canSend && (
              <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Approve the request before uploading and emailing its certificate.
              </p>
            )}
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf,.pdf"
              aria-label="Upload completed certificate PDF"
              disabled={!canSend || !selectedTemplate || busy || checkingPdf}
              onChange={(event) => { void selectPdf(event.target.files?.[0]); }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={!canSend || !selectedTemplate || busy || checkingPdf}
              className={`${buttonClass} w-full border border-dashed border-[#9bad9f] bg-[#f7faf7] text-[#123323] hover:bg-[#edf5ee]`}
            >
              {checkingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {checkingPdf ? "Checking PDF…" : pdf ? "Choose a different PDF" : "Choose completed PDF"}
            </button>
            <p className="text-xs text-[#53645b]">PDF only · Maximum 5 MB. Review the resident details and signatures before sending.</p>
            {pdf && (
              <div className="flex items-center gap-3 rounded-md border border-[#d9e2da] p-3">
                <FileText className="h-5 w-5 shrink-0 text-[#2d6947]" />
                <div className="min-w-0 flex-1">
                  <p className="break-all text-sm font-semibold text-[#122d1f]">{pdf.name}</p>
                  <p className="mt-0.5 text-xs text-[#53645b]">{(pdf.size / (1024 * 1024)).toFixed(2)} MB · PDF attachment</p>
                </div>
                <button type="button" onClick={clearPdf} disabled={busy} aria-label="Remove selected PDF" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-[#53645b] hover:bg-[#edf5ee] disabled:opacity-50">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            {pdfUrl && (
              <details className="overflow-hidden rounded-md border border-[#d9e2da]">
                <summary className="cursor-pointer bg-[#f7faf7] px-3 py-3 text-sm font-semibold text-[#34483a]">Preview selected PDF</summary>
                <iframe title="Completed certificate PDF preview" src={pdfUrl} className="h-[50vh] min-h-64 w-full bg-white" />
                <a href={pdfUrl} target="_blank" rel="noreferrer" className="block p-3 text-sm font-semibold text-[#123323] underline">Open PDF in a new tab</a>
              </details>
            )}
            {pdfError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{pdfError}</p>}
            {sent && (
              <p role="status" className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="break-words">Certificate saved. Email submitted for delivery to {recipientEmail}. Check request history for delivery updates.</span>
              </p>
            )}
            <button
              type="button"
              onClick={() => { void sendPdf(); }}
              disabled={!pdf || !selectedTemplate || !canSend || !recipientEmail || loadingRecipient || checkingPdf || busy || sent}
              className={`${buttonClass} w-full bg-[#123323] text-white hover:bg-[#214d35]`}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : sent ? <CheckCircle2 className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
              {busy ? "Saving and emailing…" : sent ? "PDF emailed" : "Save & email PDF to resident"}
            </button>
            <p className="text-xs leading-relaxed text-[#53645b]">Saves a copy in the certificate archive and emails the uploaded PDF to the address above.</p>
          </div>
        </>
      ) : (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">No matching template is available for this request type. Contact the resident to arrange the softcopy.</p>
      )}
    </section>
  );
}
