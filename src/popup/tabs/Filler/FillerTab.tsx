import React, { useEffect, useState } from 'react';
import {
  RotateCw,
  Check,
  ChevronRight,
  Sparkles,
  AlertCircle,
  Mail,
  Copy,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { COUNTRY_LIST } from '../../../lib/locales';
import { FieldType } from '../../../lib/types';
import { Card } from '../../components/Card';
import { SectionHeader } from '../../components/SectionHeader';

function getFieldCategoryTag(type: FieldType): string {
  switch (type) {
    case 'title':
    case 'first_name':
    case 'middle_name':
    case 'middle_initial':
    case 'last_name':
    case 'full_name':
      return 'Name';
    case 'email':
      return 'Email';
    case 'password':
    case 'confirm_password':
      return 'Security';
    case 'username':
      return 'Account';
    case 'phone':
    case 'phone_home':
    case 'phone_work':
    case 'phone_mobile':
    case 'fax':
      return 'Phone';
    case 'address_line1':
    case 'address_line2':
    case 'city':
    case 'state':
    case 'zip':
    case 'country':
      return 'Address';
    case 'company':
    case 'job_title':
      return 'Work';
    case 'website':
      return 'Web';
    case 'card_type':
    case 'card_number':
    case 'card_cvv':
    case 'card_exp_month':
    case 'card_exp_year':
      return 'Card';
    case 'dob':
    case 'dob_month':
    case 'dob_day':
    case 'dob_year':
      return 'Birth';
    case 'gender':
      return 'Profile';
    default:
      return 'General';
  }
}

export const FillerTab: React.FC = () => {
  const selectedCountry = useStore((s) => s.selectedCountry);
  const setSelectedCountry = useStore((s) => s.setSelectedCountry);
  const pageAnalysis = useStore((s) => s.pageAnalysis);
  const isScanningPage = useStore((s) => s.isScanningPage);
  const generatedFields = useStore((s) => s.generatedFields);
  const identityContext = useStore((s) => s.identityContext);
  const isGenerating = useStore((s) => s.isGenerating);
  const isFilling = useStore((s) => s.isFilling);
  const fillSuccess = useStore((s) => s.fillSuccess);
  const fillError = useStore((s) => s.fillError);
  const scanActiveTab = useStore((s) => s.scanActiveTab);
  const refreshIdentity = useStore((s) => s.refreshIdentity);
  const updateFieldValue = useStore((s) => s.updateFieldValue);
  const executeFill = useStore((s) => s.executeFill);
  const openCurrentTempMailbox = useStore((s) => s.openCurrentTempMailbox);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!pageAnalysis) {
      scanActiveTab();
    }
  }, []);

  useEffect(() => {
    if (fillSuccess) {
      const timer = setTimeout(() => {
        useStore.setState({ fillSuccess: false });
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [fillSuccess]);

  const hasFields = Boolean(pageAnalysis && pageAnalysis.fields.length > 0);
  const displayedEmail =
    generatedFields.find((f) => f.type === 'email')?.value ||
    identityContext?.emailAddress ||
    '';

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="flex flex-col gap-card-gap p-4">
      {/* 1. Location & Locale Selector Card */}
      <div>
        <SectionHeader title="Country" />
        <Card>
          <div className="flex items-center justify-between py-row-py px-row-px">
            <span className="text-[14px] font-semibold text-white">Country</span>
            <div className="relative">
              <select
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="appearance-none bg-[#48484C] hover:bg-[#525256] border border-white/20 text-white text-[13px] font-medium rounded-full pl-3.5 pr-8 py-1.5 focus:outline-none focus:border-white/50 transition-colors cursor-pointer shadow-sm"
              >
                {COUNTRY_LIST.map((c) => (
                  <option key={c.code} value={c.code} className="bg-[#2E2E2E] text-white">
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-white/70">
                <ChevronRight className="w-3.5 h-3.5 rotate-90" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* 2. Page Detection Status Banner */}
      <div>
        <SectionHeader
          title="Page Forms"
          action={
            <button
              onClick={(e) => {
                e.stopPropagation();
                scanActiveTab();
              }}
              disabled={isScanningPage}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#48484C] hover:bg-[#58585C] border border-white/20 text-[11.5px] font-semibold text-white transition-all cursor-pointer focus:outline-none active:scale-95 disabled:opacity-50 shadow-sm"
              title="Rescan"
            >
              <RotateCw className={`w-3 h-3 ${isScanningPage ? 'animate-spin' : ''}`} />
              <span>{isScanningPage ? 'Scanning...' : 'Rescan'}</span>
            </button>
          }
        />
        <Card
          onClick={() => scanActiveTab()}
          className="p-3.5 cursor-pointer hover:bg-white/[0.04] transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  hasFields ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-white/40'
                }`}
              />
              <div className="flex flex-col">
                <span className="text-[13.5px] font-semibold text-white leading-tight">
                  {hasFields
                    ? `${pageAnalysis!.fields.length} field${pageAnalysis!.fields.length > 1 ? 's' : ''} detected`
                    : isScanningPage
                    ? 'Scanning...'
                    : 'No forms detected'}
                </span>
                <span className="text-[11px] text-[#8E8E93] leading-tight mt-0.5 truncate max-w-[240px]">
                  {pageAnalysis?.hostname || 'Click to scan'}
                </span>
              </div>
            </div>
            {hasFields && (
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#48484C] border border-white/20 text-white/90 shadow-sm">
                Mapped
              </span>
            )}
          </div>
        </Card>
      </div>

      {/* 3. Detected Field Values Preview Panel */}
      <div>
        <div className="flex items-center justify-between px-1 mb-2">
          <span className="text-[13px] font-bold text-[#8E8E93] tracking-normal">
            Fields
          </span>
          <button
            onClick={() => refreshIdentity()}
            disabled={isGenerating}
            className="flex items-center gap-1 px-3 py-1 rounded-full bg-[#48484C] hover:bg-[#58585C] border border-white/20 text-[11.5px] font-semibold text-white transition-all focus:outline-none cursor-pointer active:scale-95 shadow-sm"
            title="Regenerate"
          >
            <RotateCw className={`w-3 h-3 ${isGenerating ? 'animate-spin' : ''}`} />
            <span>{isGenerating ? 'Generating...' : 'Regenerate'}</span>
          </button>
        </div>

        <Card>
          {generatedFields.length > 0 ? (
            generatedFields.map((field, idx) => (
              <div
                key={field.id}
                className={`flex items-center justify-between py-row-py px-row-px ${
                  idx < generatedFields.length - 1 ? 'border-b border-white/5' : ''
                }`}
              >
                <div className="flex flex-col min-w-[100px] max-w-[130px] pr-2">
                  <span className="text-[13px] font-semibold text-white truncate">
                    {field.label}
                  </span>
                  <span className="text-[10px] text-[#8E8E93] truncate uppercase tracking-wider mt-0.5 font-medium">
                    {getFieldCategoryTag(field.type)}
                  </span>
                </div>

                <div className="flex-1 flex items-center justify-end gap-1.5 min-w-0">
                  <input
                    type="text"
                    value={field.value}
                    onChange={(e) => updateFieldValue(field.id, e.target.value)}
                    className="w-full bg-[#48484C] hover:bg-[#525256] focus:bg-[#525256] border border-white/20 hover:border-white/30 focus:border-white/50 text-white text-[13px] font-normal rounded-xl px-3 py-[var(--input-padding-y)] text-right focus:outline-none transition-colors shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(field.id, field.value)}
                    className="w-7 h-7 rounded-xl bg-[#48484C] hover:bg-[#58585C] border border-white/20 flex items-center justify-center text-white/80 hover:text-white shrink-0 transition-colors cursor-pointer shadow-sm"
                    title="Copy"
                  >
                    {copiedId === field.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="p-4 text-center text-[#8E8E93] text-[13px]">
              Generating profile...
            </div>
          )}
        </Card>
      </div>

      {/* 4. Fill Details Action Button */}
      <div className="flex flex-col gap-2 pt-1">
        {fillError && (
          <div className="flex items-center gap-2 p-2.5 rounded-[12px] bg-red-500/10 border border-red-500/20 text-red-400 text-[12px]">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{fillError}</span>
          </div>
        )}

        <button
          onClick={() => executeFill()}
          disabled={!hasFields || isFilling}
          className={`w-full h-11 rounded-[14px] flex items-center justify-center gap-2 text-[14.5px] font-bold transition-all duration-200 shadow-md ${
            fillSuccess
              ? 'bg-emerald-500 text-black shadow-emerald-500/20'
              : hasFields
              ? 'bg-white text-black hover:bg-neutral-200 active:scale-[0.99] cursor-pointer'
              : 'bg-[#48484C]/50 text-white/40 border border-white/10 cursor-not-allowed opacity-50'
          }`}
        >
          {fillSuccess ? (
            <>
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Filled & Saved</span>
            </>
          ) : isFilling ? (
            <>
              <RotateCw className="w-4 h-4 animate-spin" />
              <span>Filling...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>{hasFields ? 'Fill Form' : 'No Forms Detected'}</span>
            </>
          )}
        </button>

        {/* 5. Go to Mail Inbox Shortcut */}
        {displayedEmail && (
          <button
            onClick={() => openCurrentTempMailbox()}
            className="flex items-center justify-between p-3 rounded-[14px] bg-[#2E2E2E]/80 hover:bg-[#383838]/85 active:scale-[0.99] border border-white/10 text-[#8E8E93] hover:text-white transition-all text-left group cursor-pointer shadow-sm"
          >
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <div className="w-8 h-8 rounded-xl bg-[#48484C] border border-white/20 flex items-center justify-center shrink-0 shadow-sm">
                <Mail className="w-4 h-4 text-white group-hover:scale-105 transition-transform" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[13px] font-semibold text-white leading-tight">
                  Open Mailbox
                </span>
                <span className="text-[11.5px] text-[#8E8E93] truncate font-mono mt-0.5">
                  {displayedEmail}
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#8E8E93] group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
          </button>
        )}
      </div>
    </div>
  );
};
