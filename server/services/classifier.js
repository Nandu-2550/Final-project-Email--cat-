const axios = require('axios');

const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

const loadClassifier = async () => {
  console.log('>>> [Classifier] NVIDIA NIM Llama-3.1-70b cloud engine ready.');
  return true;
};

const isTrained = () => true;

const trainClassifier = async () => true;

// ── Local keyword-based classifier (always works, no API needed) ──
const classifyByKeywords = (subject, snippet) => {
  const text = `${subject} ${snippet}`.toLowerCase();

  // Security: password resets, OTP, verification, alerts
  if (
    text.includes('password') || text.includes('otp') || text.includes('verification') ||
    text.includes('verify your') || text.includes('security alert') || text.includes('suspicious') ||
    text.includes('two-factor') || text.includes('2fa') || text.includes('login attempt') ||
    text.includes('reset your') || text.includes('confirm your identity') ||
    text.includes('unauthorized') || text.includes('phishing') || text.includes('malware') ||
    text.includes('spam') || text.includes('junk')
  ) return 'Security';

  // Finance: banking, payments, invoices, transactions
  if (
    text.includes('bank') || text.includes('payment') || text.includes('invoice') ||
    text.includes('transaction') || text.includes('billing') || text.includes('receipt') ||
    text.includes('credit card') || text.includes('debit') || text.includes('statement') ||
    text.includes('refund') || text.includes('salary') || text.includes('payroll') ||
    text.includes('tax') || text.includes('financial') || text.includes('wallet') ||
    text.includes('upi') || text.includes('paytm') || text.includes('gpay') ||
    text.includes('phonepe') || text.includes('rupee') || text.includes('dollar') ||
    text.includes('balance') || text.includes('emi') || text.includes('loan')
  ) return 'Finance';

  // College/School: academic, courses, university, exams
  if (
    text.includes('university') || text.includes('college') || text.includes('school') ||
    text.includes('assignment') || text.includes('exam') || text.includes('semester') ||
    text.includes('course') || text.includes('professor') || text.includes('lecture') ||
    text.includes('grade') || text.includes('gpa') || text.includes('student') ||
    text.includes('academic') || text.includes('syllabus') || text.includes('enrollment') ||
    text.includes('campus') || text.includes('scholarship') || text.includes('classroom') ||
    text.includes('homework') || text.includes('thesis') || text.includes('education') ||
    text.includes('faculty') || text.includes('dean')
  ) return 'College/School';

  // Work: office, projects, meetings, deadlines
  if (
    text.includes('meeting') || text.includes('deadline') || text.includes('project') ||
    text.includes('standup') || text.includes('sprint') || text.includes('jira') ||
    text.includes('slack') || text.includes('teams meeting') || text.includes('agenda') ||
    text.includes('quarterly') || text.includes('review') || text.includes('performance') ||
    text.includes('task') || text.includes('milestone') || text.includes('deliverable') ||
    text.includes('client call') || text.includes('sync up') || text.includes('onboarding') ||
    text.includes('workspace') || text.includes('colleague') || text.includes('manager') ||
    text.includes('hr ') || text.includes('leave request') || text.includes('attendance')
  ) return 'Work';

  // Business: corporate, partnerships, professional
  if (
    text.includes('business') || text.includes('partnership') || text.includes('proposal') ||
    text.includes('contract') || text.includes('agreement') || text.includes('enterprise') ||
    text.includes('vendor') || text.includes('supplier') || text.includes('procurement') ||
    text.includes('quotation') || text.includes('bid') || text.includes('tender') ||
    text.includes('revenue') || text.includes('profit') || text.includes('stakeholder') ||
    text.includes('investor') || text.includes('startup') || text.includes('pitch') ||
    text.includes('b2b') || text.includes('corporate') || text.includes('acquisition')
  ) return 'Business';

  // Promotion: marketing, offers, discounts, newsletters
  if (
    text.includes('offer') || text.includes('discount') || text.includes('sale') ||
    text.includes('promo') || text.includes('coupon') || text.includes('deal') ||
    text.includes('newsletter') || text.includes('subscribe') || text.includes('unsubscribe') ||
    text.includes('limited time') || text.includes('exclusive') || text.includes('free') ||
    text.includes('% off') || text.includes('shop now') || text.includes('buy now') ||
    text.includes('flash sale') || text.includes('clearance') || text.includes('marketing') ||
    text.includes('advertisement') || text.includes('sponsored') || text.includes('amazon') ||
    text.includes('flipkart') || text.includes('myntra') || text.includes('shopping') ||
    text.includes('order') || text.includes('delivery') || text.includes('shipped') ||
    text.includes('tracking') || text.includes('update') || text.includes('notification') ||
    text.includes('alert') || text.includes('digest') || text.includes('weekly') ||
    text.includes('monthly') || text.includes('daily')
  ) return 'Promotion';

  // Personal: friends, family, casual conversations, social
  if (
    text.includes('friend') || text.includes('family') || text.includes('birthday') ||
    text.includes('wedding') || text.includes('party') || text.includes('invitation') ||
    text.includes('congratulations') || text.includes('happy') || text.includes('love') ||
    text.includes('miss you') || text.includes('vacation') || text.includes('trip') ||
    text.includes('photo') || text.includes('social') || text.includes('facebook') ||
    text.includes('instagram') || text.includes('twitter') || text.includes('linkedin') ||
    text.includes('whatsapp') || text.includes('snapchat') || text.includes('youtube') ||
    text.includes('followed you') || text.includes('liked your') || text.includes('commented') ||
    text.includes('shared') || text.includes('tagged') || text.includes('mention')
  ) return 'Personal';

  return 'Uncategorized';
};

// ── Normalize raw NVIDIA output to a valid project category ──
const normalizeNvidiaOutput = (rawText) => {
  if (!rawText) return null;
  const text = rawText.toLowerCase().trim().replace(/[^a-z/\s]/g, '').trim();

  const categoryMap = {
    'personal': 'Personal',
    'business': 'Business',
    'finance': 'Finance',
    'security': 'Security',
    'work': 'Work',
    'college/school': 'College/School',
    'college': 'College/School',
    'school': 'College/School',
    'promotion': 'Promotion',
    'promotions': 'Promotion',
    'uncategorized': 'Uncategorized',
  };

  return categoryMap[text] || null;
};

const classifyEmail = async (subject, snippet) => {
  // Always try NVIDIA first, then fall back to local keywords
  try {
    if (process.env.NVIDIA_API_KEY) {
      const prompt = `Classify this email into exactly one of these categories: Personal, Business, Finance, Security, Work, College/School, Promotion, Uncategorized.

Category definitions:
- Personal: emails from friends, family, casual conversations, social media notifications
- Business: corporate emails, client communication, partnerships, professional networking
- Finance: bank statements, payment receipts, invoices, transactions, billing
- Security: password resets, OTP codes, verification emails, security alerts, suspicious activity
- Work: office communication, project updates, meetings, tasks, deadlines, team collaboration
- College/School: academic emails, course updates, assignments, exam schedules, university/school notifications
- Promotion: marketing emails, offers, discounts, sales, deals, newsletters, advertisements, order updates, delivery tracking
- Uncategorized: anything that doesn't clearly fit above

Email Subject: ${subject}
Email Snippet: ${snippet}

Respond with ONLY the category name, nothing else:`;

      const response = await axios.post(
        NVIDIA_API_URL,
        {
          model: process.env.NVIDIA_MODEL || 'meta/llama-3.1-70b-instruct',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 15,
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 4000,
        }
      );

      const rawCategory = response.data?.choices?.[0]?.message?.content?.trim();
      const nvidiaCategory = normalizeNvidiaOutput(rawCategory);

      if (nvidiaCategory && nvidiaCategory !== 'Uncategorized') {
        console.log(`[Classifier] NVIDIA: "${subject}" → ${nvidiaCategory}`);
        return nvidiaCategory;
      }
    }
  } catch (error) {
    console.warn('[Classifier] NVIDIA API failed, using local keywords:', error.message);
  }

  // Fallback: local keyword-based classification
  const localCategory = classifyByKeywords(subject, snippet);
  console.log(`[Classifier] Local: "${subject}" → ${localCategory}`);
  return localCategory;
};

module.exports = { classifyEmail, loadClassifier, isTrained, trainClassifier };