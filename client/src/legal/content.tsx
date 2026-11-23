/**
 * Privacy Policy + Terms of Service text.
 * Written to match what the app ACTUALLY does (see docs/HANDOFF.md "Gotchas" + PrivacyCenter.tsx).
 * If data handling changes, update this file in the same change and bump the versions in legalInfo.ts
 * and server/src/legal.ts. Not legal advice, have a lawyer review before launch.
 */
import React from 'react';
import { LEGAL, isPlaceholder } from './legalInfo';

export interface LegalSection { id: string; title: string; body: React.ReactNode }

/** Shows a value; unfilled [placeholders] are highlighted so they can't slip into production unnoticed. */
export const V: React.FC<{ v: string }> = ({ v }) =>
  isPlaceholder(v) ? <mark className="px-1 rounded bg-md-error-container text-md-on-error-container">{v}</mark> : <>{v}</>;

const P: React.FC<{ children: React.ReactNode }> = ({ children }) => <p className="mt-3 first:mt-0">{children}</p>;
const UL: React.FC<{ children: React.ReactNode }> = ({ children }) => <ul className="mt-3 space-y-2 list-disc pl-5 marker:text-md-primary">{children}</ul>;
const B: React.FC<{ children: React.ReactNode }> = ({ children }) => <strong className="text-md-on-surface font-semibold">{children}</strong>;

const Table: React.FC<{ rows: [string, string][]; head: [string, string] }> = ({ rows, head }) => (
  <div className="mt-3 overflow-x-auto rounded-[16px] border border-md-outline-variant/40">
    <table className="w-full text-sm">
      <thead className="bg-md-surface-container-high text-md-on-surface"><tr><th className="text-left p-3 font-semibold">{head[0]}</th><th className="text-left p-3 font-semibold">{head[1]}</th></tr></thead>
      <tbody className="divide-y divide-md-outline-variant/30">
        {rows.map(([a, b]) => <tr key={a}><td className="p-3 align-top text-md-on-surface font-medium w-[38%]">{a}</td><td className="p-3 align-top">{b}</td></tr>)}
      </tbody>
    </table>
  </div>
);

const contact = (
  <>
    Grievance Officer: <V v={LEGAL.grievanceOfficer} />, <V v={LEGAL.grievanceEmail} />. Postal address: <V v={LEGAL.address} />.
  </>
);

// =====================================================================================================
// PRIVACY POLICY
// =====================================================================================================
export const PRIVACY: LegalSection[] = [
  {
    id: 'who', title: '1. Who we are and what this covers', body: (<>
      <P>This Privacy Policy explains how <B>{LEGAL.brand}</B> (“Aastha”, “we”, “us”), operated by <V v={LEGAL.operator} />, collects, uses, shares and protects personal data when you use the Aastha website ({LEGAL.website}), the Aastha mobile app and related services (together, the “Service”).</P>
      <P>For your personal data we are the <B>Data Fiduciary</B> under India’s Digital Personal Data Protection Act, 2023 (“DPDP Act”) and its Rules. We also follow the Information Technology Act, 2000 and the rules made under it. This policy is our notice to you under Section 5 of the DPDP Act.</P>
      <P>By creating an account you give consent to the processing described here for the purposes described here. You can withdraw consent at any time (Section 11), withdrawal does not affect processing already done.</P>
    </>),
  },
  {
    id: 'summary', title: '2. The short version', body: (<UL>
      <li>We collect what you give us (account details, chats, diary, moods, voice notes you record) and a little technical data needed to run the Service.</li>
      <li>Your chats, diary, moods and memories are <B>encrypted when stored</B>. This is <B>not end-to-end encryption</B>: to reply to you, our server decrypts your message and sends it to an AI provider.</li>
      <li>We <B>never sell</B> your personal data, show you ads, or use advertising or analytics trackers.</li>
      <li>You can <B>export</B> everything and <B>delete</B> your account (and almost all data) in Settings at any time.</li>
      <li>Aastha is for adults ({LEGAL.minAge}+) and is <B>not a medical or emergency service</B>.</li>
    </UL>),
  },
  {
    id: 'collect', title: '3. What we collect', body: (<>
      <Table head={['Category', 'What it includes']} rows={[
        ['Account data', 'Name, username, email address, date of birth, a hash of your password (we never store the password itself), your security question and a hash of its answer, your diary password (hashed), plan and payment status.'],
        ['What you write and say', 'Chat messages, diary entries, mood logs (including custom moods you create), reactions to Aastha’s replies, and things you choose to tell Aastha about yourself.'],
        ['Voice', 'Voice notes you record (kept so you can play them back, and transcribed so Aastha can read them), and voice notes Aastha creates for you.'],
        ['Images', 'Photos you choose to send in chat (sent to an AI model to describe them; not kept by us as files), a profile picture and a wallpaper if you set them.'],
        ['What Aastha learns', 'A short summary and a list of facts you told Aastha (“memory”), dated things you mentioned (e.g. an exam) for gentle check-ins, how you text (length, emoji, language, not the messages themselves), and a closeness level.'],
        ['People you mention (“The Web”)', 'Only if you tap “Scan my chats”: names, nicknames, notes, an optional photo, and the role/feeling labels for people you talk about. See section 11.'],
        ['Clone Mode (optional)', 'Your consent record, the name of the person (if it is someone else), style notes derived from a screenshot or exported chat you provide, and an optional voice sample. The screenshot itself and the raw exported chat are not stored.'],
        ['Payments', 'Razorpay order ID, payment ID, amount, status and date. We never see or store your card, UPI or bank details, Razorpay handles those.'],
        ['Device and technical', 'Your device time zone (to keep streaks, check-ins and dates on your local time), notification/push tokens if you enable notifications, app settings, and IP address and request logs kept by our hosting providers for security. Crash reports, if enabled, with message text, emails, numbers and tokens removed.'],
      ]} />
      <P><B>We do not collect</B> your contacts, precise location, advertising IDs, or browsing activity outside Aastha.</P>
    </>),
  },
  {
    id: 'use', title: '4. Why we use it', body: (<>
      <P>We use personal data only for these specific purposes:</P>
      <UL>
        <li><B>To provide the Service</B>create and secure your account, generate replies, remember context you shared, store your diary and moods, play voice notes, run widgets.</li>
        <li><B>To keep you safe</B>every message is automatically checked for signs of crisis so we can show helpline numbers and respond with care. We do not contact anyone or share this check outside the Service, except where Indian law requires it.</li>
        <li><B>To personalise</B>follow your language and texting style, closeness level, and gentle check-ins (you can turn check-ins off).</li>
        <li><B>Payments</B>process purchases, prevent fraud and duplicate charges, handle refunds and keep legally required records.</li>
        <li><B>Communication</B>verification codes, password-reset codes, important service or policy notices, and (if enabled) notifications.</li>
        <li><B>Security and abuse prevention</B>rate limits, detecting misuse, fixing bugs (including privacy-filtered crash reports).</li>
        <li><B>Improving Aastha</B>only if you turn on <B>Data donation</B>: short conversation snippets with your name removed and not linked to your account.</li>
        <li><B>Legal compliance</B>tax and accounting records, responding to lawful requests, enforcing our Terms.</li>
      </UL>
      <P>We do <B>not</B> use your data for advertising, sell it, or rent it.</P>
    </>),
  },
  {
    id: 'ai', title: '5. AI and automated processing', body: (<>
      <P>Aastha’s replies are generated by artificial intelligence. To create them, the relevant part of your conversation, memory summary and settings is sent to an AI provider (section 6). Images you send go to an AI vision model; voice notes are transcribed by an AI speech model; Aastha’s voice notes are generated by our voice server.</P>
      <P>Automated systems also: check messages for crisis signs; extract facts and dated events you mention; suggest people’s roles in “The Web”; and pick GIFs. None of this produces decisions with legal or similarly significant effects on you. AI can be wrong, you can correct or delete what Aastha has learned (section 9).</P>
    </>),
  },
  {
    id: 'share', title: '6. Who we share it with', body: (<>
      <P>We share personal data only with service providers (“Data Processors”) who process it on our instructions to run the Service, under contracts or terms that require them to protect it:</P>
      <Table head={['Provider (purpose)', 'What they receive']} rows={[
        ['Groq (AI replies, speech-to-text)', 'Conversation text and context needed for a reply; your voice recordings for transcription.'],
        ['Google, Gemini API (backup AI, image understanding)', 'Same as above when the main provider is unavailable; images you send.'],
        ['Hugging Face (our voice server)', 'Text to be spoken; your Clone Mode voice sample if you enabled a cloned voice.'],
        ['Razorpay (payments)', 'Order amount and the details you enter on Razorpay’s checkout.'],
        ['Resend (email)', 'Your email address and the message (codes, check-ins, notices).'],
        ['Hosting and database providers (e.g. Render, Vercel, our MongoDB host)', 'All stored data, in encrypted form where described in section 7.'],
        ['GIPHY / Tenor (GIFs, if enabled)', 'Only a short search phrase such as “happy dance”, never your messages.'],
        ['Google, YouTube Data API (music search)', 'Only the song or mood search phrase.'],
        ['Web push services (browser vendors)', 'An encrypted notification for your device, if you enabled notifications.'],
        ['Sentry (crash reports, if enabled)', 'Technical error details with message text, emails, phone numbers, cookies and tokens removed.'],
      ]} />
      <P>We may also disclose personal data: (a) when required by law, court order or a lawful request from a government authority; (b) to protect the safety of any person in an emergency, as permitted by law; (c) to enforce our Terms or defend legal claims; (d) to a successor if Aastha is merged, acquired or sold, in that case this policy continues to apply and you will be told.</P>
    </>),
  },
  {
    id: 'transfer', title: '7. Where your data is processed, and how it is protected', body: (<>
      <P>Some providers above process data outside India (for example in the United States or the European Union). Section 16 of the DPDP Act allows this except to countries restricted by the Government of India; we will stop any transfer to a restricted country.</P>
      <UL>
        <li>Chats, diary content, moods, memories, people in The Web, follow-ups, custom mood names, all voice notes (yours and Aastha’s), training samples you donate, and your profile details (name, email, date of birth, city, profile picture and wallpaper) are encrypted at rest with AES-256-GCM. Email is looked up only through a keyed hash. Encryption keys are rotated without downtime, and stored data is re-encrypted with the new key. Data travels over HTTPS (TLS).</li>
        <li>Not encrypted, because the app needs to read or search them: your username, account settings, plan and payment status, dates and times, mood levels, chosen reaction emoji and similar technical records.</li>
        <li>Your diary is additionally encrypted inside the app with a personal key; we store that key only in a form locked by your account password (and your security answer, for recovery).</li>
        <li>Passwords and security answers are stored only as salted hashes. Sign-in tokens can be revoked; repeated wrong codes or answers are locked out.</li>
        <li>Because our server must read messages to reply, this is <B>not end-to-end encryption</B>. Our staff do not read your content except where you ask us to (e.g. a support request) or the law requires it.</li>
      </UL>
      <P>No system is perfectly secure. If a personal data breach occurs, we will inform the Data Protection Board of India and affected users as required by the DPDP Act and Rules, and take steps to limit harm.</P>
    </>),
  },
  {
    id: 'retention', title: '8. How long we keep it', body: (
      <Table head={['Data', 'How long']} rows={[
        ['Account, chats, diary, moods, memory, The Web, settings', 'Until you delete them or your account. Account deletion removes them from our active database immediately.'],
        ['Voice notes (yours and Aastha’s)', 'Automatically deleted after 30 days.'],
        ['Verification and reset codes', 'Valid for about 10 minutes; replaced when a new one is sent.'],
        ['Donated snippets (only if Data donation is on)', 'Up to 365 days, then deleted automatically. They are not linked to your account, so we cannot find or delete a specific person’s snippets.'],
        ['Payment records', 'Order ID, payment ID, amount, status and date are kept for up to 8 years after account deletion (without your name or content) because Indian tax and accounting laws require it.'],
        ['Server logs and crash reports', 'Kept by our providers for their standard periods (typically up to 90 days).'],
        ['Backups (if our providers keep them)', 'Overwritten on the provider’s normal schedule.'],
      ]} />
    ),
  },
  {
    id: 'rights', title: '9. Your rights and how to use them', body: (<>
      <P>Under the DPDP Act you have the right to:</P>
      <UL>
        <li><B>Access</B> a summary of your data and how it is processed, use <B>Settings → Data & Privacy → Export my data</B> for a full copy, or write to us.</li>
        <li><B>Correct and update</B> your data, edit your profile in Settings; for anything you can’t edit yourself (for example a memory fact), write to us.</li>
        <li><B>Erase</B> your data, delete diary entries, custom moods and people in the app, or delete your whole account in Settings (subject to section 8).</li>
        <li><B>Withdraw consent</B>turn off optional features (check-ins, GIFs, Data donation, Clone Mode, notifications) at any time, or delete your account.</li>
        <li><B>Grievance redressal</B>complain to our Grievance Officer (section 14). If you are not satisfied, you may complain to the Data Protection Board of India.</li>
        <li><B>Nominate</B> a person to exercise your rights if you die or become incapable, write to us with their details.</li>
      </UL>
      <P>We respond to requests without undue delay and within the time limits set by law (we aim for 30 days or sooner). We may need to verify it is really you. We don’t charge for reasonable requests.</P>
    </>),
  },
  {
    id: 'children', title: '10. Age limit', body: (
      <P>The Service is only for people aged {LEGAL.minAge} or older. We ask for your date of birth at sign-up and do not create accounts for anyone under {LEGAL.minAge}. If we learn that an account belongs to someone under {LEGAL.minAge}, we will delete it and its data. If you believe a child is using Aastha, please tell us (section 14).</P>
    ),
  },
  {
    id: 'others', title: '11. Information about other people', body: (<>
      <P>When you talk about other people, or use “The Web” or Clone Mode, you may share information about them. You should only share what you are entitled to share, and use these features for your own personal purposes. Clone Mode for another person requires that person’s consent (see our Terms).</P>
      <P>Information about people in The Web is encrypted and visible only to you. If someone believes their information is held in Aastha, they can contact us and we will help, consistent with the law and the account holder’s rights.</P>
    </>),
  },
  {
    id: 'storage', title: '12. Cookies and storage on your device', body: (<>
      <P>We use one essential, secure cookie to keep you signed in. The app also stores data on your device to work properly: your sign-in token, your last 50 chat messages (so the app opens instantly, removed when you log out), settings such as theme and window style, and drafts. We do <B>not</B> use advertising or analytics cookies or third-party trackers.</P>
      <P>Fonts are bundled with the app (no requests to font services). Some features load content from other services when you use them (YouTube videos, GIFs), those services apply their own policies.</P>
    </>),
  },
  {
    id: 'changes', title: '13. Changes to this policy', body: (
      <P>We will update this policy when our practices change. For material changes we will tell you in the app (and by email where appropriate) and ask for your consent again before the new practice applies to you. The version and effective date are shown at the top.</P>
    ),
  },
  {
    id: 'contact', title: '14. Contact and Grievance Officer', body: (<>
      <P>Questions, requests or complaints about your data: <V v={LEGAL.supportEmail} />. {contact}</P>
      <P>The Grievance Officer acknowledges complaints within 24 hours and resolves them within the time limits set by law (no later than 15 days under the IT Rules, and within the period set by the DPDP Rules). You may escalate to the Data Protection Board of India.</P>
    </>),
  },
];

// =====================================================================================================
// TERMS OF SERVICE
// =====================================================================================================
export const TERMS: LegalSection[] = [
  {
    id: 'agreement', title: '1. Agreement', body: (<>
      <P>These Terms of Service (“Terms”) are a legal agreement between you and <V v={LEGAL.operator} /> (“Aastha”, “we”, “us”) for the Aastha website, app and related services (the “Service”). By creating an account or using the Service you agree to these Terms and to our Privacy Policy. If you don’t agree, please don’t use the Service.</P>
      <P>These Terms are an electronic record under the Information Technology Act, 2000 and do not need a physical or digital signature.</P>
    </>),
  },
  {
    id: 'eligibility', title: '2. Who can use Aastha', body: (<UL>
      <li>You must be at least <B>{LEGAL.minAge} years old</B> and able to form a binding contract under Indian law.</li>
      <li>You must give accurate sign-up information and keep it up to date. One person, one account.</li>
      <li>You may not use the Service if we have previously suspended your account for breaking these Terms, or if the law prohibits you from using it.</li>
    </UL>),
  },
  {
    id: 'not-medical', title: '3. What Aastha is, and is not', body: (<>
      <P>Aastha is an <B>AI companion</B> for everyday wellbeing: conversation, journaling, mood tracking and calming tools.</P>
      <UL>
        <li><B>Aastha is not a doctor, therapist, counsellor or emergency service</B>, and does not provide medical, psychological, legal or financial advice, diagnosis or treatment.</li>
        <li>Replies are generated by AI. They can be <B>inaccurate, incomplete or inappropriate</B>, and Aastha may misunderstand you. Don’t rely on them for important decisions; use your own judgment and consult qualified professionals.</li>
        <li><B>If you are in crisis or thinking about harming yourself or others, contact Tele-MANAS on 14416 (free, 24/7) or emergency services on 112 immediately.</B> Aastha may show helpline numbers but cannot call anyone for you or monitor your safety.</li>
        <li>Features that mention memory, check-ins or closeness describe how the software behaves; Aastha is not a person and does not have feelings or obligations.</li>
      </UL>
    </>),
  },
  {
    id: 'account', title: '4. Your account', body: (<UL>
      <li>Keep your password, diary password and security answer secret. You are responsible for activity on your account.</li>
      <li>Tell us immediately at <V v={LEGAL.supportEmail} /> if you suspect unauthorised access. We may sign you out of all devices to protect you.</li>
      <li>You can delete your account at any time in Settings. Deletion is permanent (see the Privacy Policy for what we must keep).</li>
    </UL>),
  },
  {
    id: 'use', title: '5. Acceptable use', body: (<>
      <P>You agree not to use the Service to, or to try to:</P>
      <UL>
        <li>break any law, or host, share or generate content that is unlawful under Indian law, including content listed in Rule 3(1)(b) of the IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021;</li>
        <li>harass, threaten, defame, stalk or abuse anyone, or promote violence, self-harm or suicide to others;</li>
        <li>create or request sexual content involving minors, or any sexually explicit content;</li>
        <li>impersonate anyone or mislead people about who they are talking to, including using Clone Mode outside the app or without the person’s consent (section 6);</li>
        <li>upload other people’s personal data, images or voices without the right to do so;</li>
        <li>get around usage limits, payments or security (for example with multiple accounts, scripts or automated access), or scrape, copy or resell the Service or its outputs at scale;</li>
        <li>reverse-engineer, attack, overload, or introduce malware into the Service, or probe it for vulnerabilities without our written permission;</li>
        <li>use the Service to build a competing AI product or to train AI models.</li>
      </UL>
      <P>We may remove content, limit features, or suspend accounts that break these rules (section 13).</P>
    </>),
  },
  {
    id: 'clone', title: '6. Clone Mode', body: (<UL>
      <li>Clone Mode creates an <B>AI imitation of a texting style</B> (and optionally a voice). Every reply is labelled as an AI imitation.</li>
      <li>You may create an imitation of yourself, or of another adult <B>only with their clear consent</B>. You confirm this in the app, and you are responsible if it is not true.</li>
      <li>You must not use it to deceive anyone, to impersonate the person outside the app, to imitate public figures, or to harass, defame or embarrass anyone.</li>
      <li>Crisis messages always go to Aastha, not the imitation. We may disable Clone Mode for any account at our discretion.</li>
    </UL>),
  },
  {
    id: 'content', title: '7. Your content', body: (<>
      <P><B>You own what you write, say and upload</B> (“your content”). You give us a limited, non-exclusive, royalty-free, worldwide licence to host, store, process, transmit and display your content <B>only as needed to provide and secure the Service for you</B> (for example, to send it to an AI provider to generate a reply). This licence ends when you delete the content or your account, except for copies we must keep by law.</P>
      <P>If you turn on Data donation, you also allow us to use the de-identified snippets described in the Privacy Policy to improve Aastha. You can turn it off at any time (future snippets only).</P>
      <P>You may use Aastha’s replies for your own personal purposes. Replies may be similar to replies given to others and are provided without any guarantee.</P>
      <P>You confirm you have the rights needed for anything you upload, including photos and voices of other people.</P>
    </>),
  },
  {
    id: 'plans', title: '8. Plans and payments', body: (<>
      <UL>
        <li><B>Free:</B> 16 messages and 2 voice notes per 24 hours, counted from your first message; after that, replies continue in a lighter “Eco” mode. Limits may change with notice in the app.</li>
        <li><B>Pro, ₹49 for 30 days:</B> unlimited chat on the best models, image understanding and voice mode, for 30 days from purchase. Buying again adds 30 days.</li>
        <li><B>Voice Pass, ₹19 for 24 hours:</B> unlimited voice calls and voice notes for 24 hours from purchase. Buying again adds 24 hours.</li>
        <li>These are <B>one-time payments and do not renew automatically</B>. Prices are in Indian Rupees and include applicable taxes unless shown otherwise.</li>
        <li>Payments are processed by Razorpay under its terms. Your plan starts when the payment is confirmed.</li>
        <li>Fair use applies: we may limit automated, abusive or excessive use that harms the Service for others.</li>
      </UL>
    </>),
  },
  {
    id: 'refunds', title: '9. Cancellations and refunds', body: (<>
      <P>Because plans are digital services that start immediately, <B>purchases cannot be cancelled and are not refundable for change of mind</B> once the plan is active. We will refund you in full if:</P>
      <UL>
        <li>you were charged more than once for the same purchase;</li>
        <li>you were charged but the plan was not activated within 24 hours and we cannot activate it;</li>
        <li>the Service was unavailable for most of your plan period because of a fault on our side (refund or extension, your choice, in proportion to the time lost); or</li>
        <li>a refund is otherwise required by law, including the Consumer Protection Act, 2019 and the Consumer Protection (E-Commerce) Rules, 2020.</li>
      </UL>
      <P>To ask for a refund, email <V v={LEGAL.supportEmail} /> within 30 days of the payment with your Razorpay payment ID. Approved refunds are sent to the original payment method within 7 working days of approval (your bank may take a few more days).</P>
    </>),
  },
  {
    id: 'third', title: '10. Third-party services', body: (
      <P>Some features use other services (for example Razorpay for payments, YouTube for music, GIPHY/Tenor for GIFs). Your use of those services is subject to their terms and privacy policies. We are not responsible for third-party content or services, but we choose providers carefully and share only what is needed (see the Privacy Policy).</P>
    ),
  },
  {
    id: 'changes-service', title: '11. Changes to the Service', body: (
      <P>We continuously improve Aastha and may add, change or remove features. If we remove a paid feature you have already paid for during an active plan period, we will offer a proportionate refund or extension. We may suspend the Service temporarily for maintenance, security or reasons beyond our control.</P>
    ),
  },
  {
    id: 'ip', title: '12. Our rights', body: (
      <P>The Service, including the software, design, the Aastha name and logo, and our content, belongs to us or our licensors and is protected by law. We give you a personal, limited, non-exclusive, non-transferable, revocable licence to use the Service for its intended purpose under these Terms. If you send us feedback, we may use it without obligation to you.</P>
    ),
  },
  {
    id: 'termination', title: '13. Suspension and termination', body: (<>
      <P>You may stop using the Service and delete your account at any time.</P>
      <P>We may suspend or terminate your access, with notice where reasonably possible, if you break these Terms, if required by law, or to protect you, other people or the Service. If we terminate your account without cause while a paid plan is active, we will refund the unused part. If we terminate it because you broke these Terms, no refund is due. Sections that by their nature should survive (for example 7, 12, 14–17) continue after termination.</P>
    </>),
  },
  {
    id: 'disclaimer', title: '14. Disclaimers', body: (
      <P>To the fullest extent permitted by law, the Service is provided <B>“as is” and “as available”</B>. We do not promise that it will be uninterrupted, error-free, secure from every threat, or that AI replies will be accurate, suitable or safe for any particular purpose. Nothing in these Terms excludes rights you have under consumer protection law that cannot be excluded.</P>
    ),
  },
  {
    id: 'liability', title: '15. Limitation of liability', body: (<>
      <P>To the fullest extent permitted by law, we are not liable for any indirect, incidental, special, consequential or punitive damages, or for loss of profits, data, goodwill or opportunity, arising from or related to the Service or any AI reply, even if we were told such loss was possible.</P>
      <P>Our total liability for all claims relating to the Service is limited to the greater of (a) the amount you paid us in the 3 months before the event giving rise to the claim, or (b) ₹1,000.</P>
      <P>Nothing in these Terms limits liability that cannot be limited by law, including for fraud, gross negligence or wilful misconduct.</P>
    </>),
  },
  {
    id: 'indemnity', title: '16. Indemnity', body: (
      <P>To the extent permitted by law, you agree to compensate us for reasonable losses, costs and legal fees arising from a third-party claim caused by your breach of these Terms, your content, or your misuse of the Service (including Clone Mode or information you shared about other people).</P>
    ),
  },
  {
    id: 'law', title: '17. Governing law and disputes', body: (<>
      <P>These Terms are governed by the laws of India. Before starting any legal proceeding, please contact our Grievance Officer so we can try to resolve the issue informally within 30 days.</P>
      <P>Subject to that, the courts at <V v={LEGAL.jurisdictionCity} /> have exclusive jurisdiction, but nothing here takes away your right to approach a Consumer Disputes Redressal Commission or any other forum available to you by law.</P>
    </>),
  },
  {
    id: 'changes', title: '18. Changes to these Terms', body: (
      <P>We may update these Terms. For material changes we will tell you in the app (and by email where appropriate) before they take effect and ask you to accept them; if you don’t accept, you can stop using the Service and delete your account, and we will refund any unused part of an active paid plan.</P>
    ),
  },
  {
    id: 'general', title: '19. General', body: (<UL>
      <li>These Terms and the Privacy Policy are the entire agreement between you and us about the Service.</li>
      <li>If any part is found unenforceable, the rest stays in effect and that part is applied as closely as the law allows.</li>
      <li>If we don’t enforce a right immediately, we haven’t waived it.</li>
      <li>You may not transfer your rights under these Terms. We may transfer ours to a successor that continues the Service under these Terms.</li>
      <li>We are not responsible for delays or failures caused by events beyond our reasonable control (force majeure).</li>
      <li>We may send notices in the app or by email to the address on your account. If these Terms are translated, the English version prevails.</li>
    </UL>),
  },
  {
    id: 'contact', title: '20. Contact and Grievance Officer', body: (<>
      <P>Support: <V v={LEGAL.supportEmail} />. {contact}</P>
      <P>In line with the IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, the Grievance Officer acknowledges complaints within 24 hours and resolves them within 15 days.</P>
    </>),
  },
];
