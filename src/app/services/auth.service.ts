import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { BehaviorSubject, Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private supabase: SupabaseClient;
  // undefined = loading, null = not logged in, User = logged in
  private _currentUser = new BehaviorSubject<User | null | undefined>(undefined);
  // Cache for user profile
  // undefined = loading/not loaded, null = loaded but empty, Object = loaded
  private _userProfile = new BehaviorSubject<any>(undefined);

  constructor(private router: Router) {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);

    // Initialize user
    this.supabase.auth.getUser().then(({ data }) => {
      console.log('AuthService: getUser init', data);
      // Only set if we haven't already set it via onAuthStateChange (which might fire first)
      if (this._currentUser.value === undefined) {
        this._currentUser.next(data.user);
        if (data.user) {
          this.loadUserProfile(data.user.id);
        }
      }
    });

    // Listen for auth changes
    this.supabase.auth.onAuthStateChange((event, session) => {
      console.log('AuthService: onAuthStateChange', event, session?.user?.email);

      // Don't redirect if this is a password recovery event
      if (event === 'PASSWORD_RECOVERY') {
        // User clicked password reset link - stay on login page to collect new password
        this._currentUser.next(session?.user ?? null);
        return;
      }

      if (event === 'SIGNED_IN' && session) {
        this._currentUser.next(session.user);
        // Wait for profile to determine redirection
        this.loadUserProfile(session.user.id).then(profile => {
          const isPasswordReset = window.location.href.includes('type=recovery');
          if (!isPasswordReset && this.router.url === '/login') {
            if (profile?.role === 'SUPER_ADMIN' || profile?.role === 'HR') {
              this.router.navigate(['/hr-dashboard']);
            } else {
              this.router.navigate(['/']);
            }
          }
        });
      } else if (event === 'SIGNED_OUT') {
        this._currentUser.next(null);
        this._userProfile.next(null); // Clear profile
        this.router.navigate(['/login']);
      } else if (event === 'INITIAL_SESSION') {
        // Handle initial session load
        this._currentUser.next(session?.user || null);
        if (session?.user) {
          this.loadUserProfile(session.user.id);
        }
      }
    });
  }

  get currentUser$(): Observable<User | null | undefined> {
    return this._currentUser.asObservable().pipe(shareReplay(1));
  }

  get userProfile$(): Observable<any> {
    return this._userProfile.asObservable().pipe(shareReplay(1));
  }

  get currentUserValue(): User | null | undefined {
    return this._currentUser.value;
  }

  async signIn(email: string) {
    return this.supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin
      }
    });
  }

  async signInWithPassword(email: string, password: string) {
    return this.supabase.auth.signInWithPassword({
      email,
      password
    });
  }

  async signUp(email: string, password: string, fullName?: string) {
    return this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        }
      }
    });
  }

  async resetPassword(email: string) {
    // Supabase will append #type=recovery&access_token=... to the redirect URL
    // The login page will handle the URL params to show the reset password form
    return this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`
    });
  }

  async updatePassword(newPassword: string) {
    return this.supabase.auth.updateUser({
      password: newPassword
    });
  }

  async verifyOtp(email: string, token: string) {
    return this.supabase.auth.verifyOtp({ email, token, type: 'email' });
  }

  async signOut() {
    return this.supabase.auth.signOut();
  }

  // Load and cache user profile
  async loadUserProfile(userId: string) {
    // If we already have the profile for this user, don't fetch again unless forced
    if (this._userProfile.value && this._userProfile.value.id === userId) {
      return this._userProfile.value;
    }

    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }

    console.log('AuthService: Profile loaded', data);
    this._userProfile.next(data);
    return data;
  }

  // Get profile from cache or fetch if missing
  async getUserProfile() {
    const user = this.currentUserValue;
    if (!user) return null;

    if (this._userProfile.value && this._userProfile.value.id === user.id) {
      return this._userProfile.value;
    }

    return this.loadUserProfile(user.id);
  }
}
