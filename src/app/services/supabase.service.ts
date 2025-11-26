import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private _client: SupabaseClient | null = null;

  constructor() {
    // Create a single shared Supabase client instance
    // Configure with optimized settings to reduce token refresh calls
    this._client = createClient(environment.supabaseUrl, environment.supabaseKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        // Reduce token refresh frequency by using longer intervals
        // Supabase defaults to refreshing 60 seconds before expiry
        // We'll let it use defaults but ensure only one client handles refresh
      }
    });
  }

  get client(): SupabaseClient {
    if (!this._client) {
      this._client = createClient(environment.supabaseUrl, environment.supabaseKey);
    }
    return this._client;
  }
}

