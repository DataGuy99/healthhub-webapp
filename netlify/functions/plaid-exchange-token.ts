import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { createClient } from '@supabase/supabase-js';

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID || '';
const PLAID_SECRET = process.env.PLAID_SECRET || '';
const PLAID_ENV = process.env.PLAID_ENV || 'sandbox';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

const configuration = new Configuration({
  basePath: PlaidEnvironments[PLAID_ENV as keyof typeof PlaidEnvironments],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
      'PLAID-SECRET': PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface RequestBody {
  publicToken: string;
  userId: string;
  institutionName?: string;
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const body: RequestBody = JSON.parse(event.body || '{}');
    const { publicToken, userId, institutionName } = body;

    if (!publicToken || !userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'publicToken and userId are required' }),
      };
    }

    // Exchange public token for access token
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    // Get account details
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    const institution = accountsResponse.data.item.institution_id || null;
    const accounts = accountsResponse.data.accounts;

    // Store each account in database
    const accountInserts = accounts.map((account) => ({
      user_id: userId,
      plaid_access_token: accessToken,
      plaid_item_id: itemId,
      institution_name: institutionName || 'Unknown',
      institution_id: institution,
      account_name: account.name,
      account_mask: account.mask,
      account_type: account.type,
      account_subtype: account.subtype,
      is_active: true,
    }));

    const { data, error } = await supabase
      .from('bank_accounts')
      .insert(accountInserts)
      .select();

    if (error) {
      console.error('Database error:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to store bank accounts', details: error.message }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        accounts: data,
        itemId: itemId,
      }),
    };
  } catch (error: any) {
    console.error('Error exchanging token:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to exchange token',
        details: error.message,
      }),
    };
  }
};
