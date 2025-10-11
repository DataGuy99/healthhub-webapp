import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { Configuration, PlaidApi, PlaidEnvironments, Transaction as PlaidTransaction } from 'plaid';
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
  bankAccountId: string;
  userId: string;
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
    const { bankAccountId, userId } = body;

    if (!bankAccountId || !userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'bankAccountId and userId are required' }),
      };
    }

    // Get bank account details
    const { data: bankAccount, error: bankError } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('id', bankAccountId)
      .eq('user_id', userId)
      .single();

    if (bankError || !bankAccount) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Bank account not found' }),
      };
    }

    // Get sync cursor (if exists)
    const { data: cursorData } = await supabase
      .from('plaid_sync_cursors')
      .select('cursor')
      .eq('bank_account_id', bankAccountId)
      .single();

    const cursor = cursorData?.cursor;

    // Sync transactions using Plaid's sync API
    let hasMore = true;
    let nextCursor = cursor;
    const allTransactions: PlaidTransaction[] = [];

    while (hasMore) {
      const syncRequest: any = {
        access_token: bankAccount.plaid_access_token,
      };

      if (nextCursor) {
        syncRequest.cursor = nextCursor;
      }

      const syncResponse = await plaidClient.transactionsSync(syncRequest);

      allTransactions.push(...syncResponse.data.added);
      nextCursor = syncResponse.data.next_cursor;
      hasMore = syncResponse.data.has_more;
    }

    // Transform and insert transactions
    if (allTransactions.length > 0) {
      const transactionInserts = allTransactions.map((txn) => ({
        user_id: userId,
        bank_account_id: bankAccountId,
        plaid_transaction_id: txn.transaction_id,
        amount: txn.amount,
        date: txn.date,
        timestamp: txn.datetime || new Date().toISOString(),
        merchant: txn.merchant_name || txn.name,
        description: txn.name,
        auto_categorized: false,
      }));

      const { error: insertError } = await supabase
        .from('transactions')
        .upsert(transactionInserts, {
          onConflict: 'user_id,plaid_transaction_id',
        });

      if (insertError) {
        console.error('Transaction insert error:', insertError);
      }
    }

    // Update sync cursor
    await supabase
      .from('plaid_sync_cursors')
      .upsert({
        user_id: userId,
        bank_account_id: bankAccountId,
        cursor: nextCursor,
        last_synced_at: new Date().toISOString(),
      }, {
        onConflict: 'bank_account_id',
      });

    // Update last_synced_at on bank account
    await supabase
      .from('bank_accounts')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', bankAccountId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        synced: allTransactions.length,
        cursor: nextCursor,
      }),
    };
  } catch (error: any) {
    console.error('Error syncing transactions:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to sync transactions',
        details: error.message,
      }),
    };
  }
};
