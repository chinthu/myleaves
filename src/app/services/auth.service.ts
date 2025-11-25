import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { BehaviorSubject, Observable } from 'rxjs';
import { shareReplay, distinctUntilChanged } from 'rxjs/operators';
import { Router } from '@angular/router';
import { LoadingService } from './loading.service';

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

  constructor(private router: Router, private loadingService: LoadingService) {
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
        // Wait for profile to determine redirection (don't show loading spinner here as login component handles it)
        this.loadUserProfile(session.user.id, false).then(profile => {
          console.log('AuthService: Profile loaded for routing', profile);
          const isPasswordReset = window.location.href.includes('type=recovery');
          const currentUrl = this.router.url;
          const isOnLoginPage = currentUrl === '/login' || currentUrl.startsWith('/login');
          
          console.log('AuthService: Routing check', { isPasswordReset, currentUrl, isOnLoginPage, role: profile?.role });
          
          if (!isPasswordReset && isOnLoginPage && profile) {
            // Use setTimeout to ensure navigation happens after Angular's change detection
            setTimeout(() => {
              if (profile.role === 'SUPER_ADMIN' || profile.role === 'HR') {
                console.log('AuthService: Navigating to hr-dashboard for role:', profile.role);
                this.router.navigate(['/hr-dashboard']).catch(err => {
                  console.error('Navigation error:', err);
                });
              } else {
                console.log('AuthService: Navigating to dashboard for role:', profile.role);
                this.router.navigate(['/']).catch(err => {
                  console.error('Navigation error:', err);
                });
              }
            }, 100);
          }
          // Ensure loading is hidden after profile loads (in case it was shown during sign in)
          this.loadingService.hide();
        }).catch(err => {
          console.error('Error loading profile for routing:', err);
          // Ensure loading is hidden even on error
          this.loadingService.hide();
        });
      } else if (event === 'SIGNED_OUT') {
        this._currentUser.next(null);
        this._userProfile.next(null); // Clear profile
        this.router.navigate(['/login']);
      } else if (event === 'INITIAL_SESSION') {
        // Handle initial session load
        this._currentUser.next(session?.user || null);
        if (session?.user) {
          this.loadUserProfile(session.user.id, false).then(profile => {
            if (!profile) return;
            
            const currentUrl = this.router.url;
            const isOnLoginPage = currentUrl === '/login' || currentUrl.startsWith('/login');
            const isOnDefaultRoute = currentUrl === '/' || currentUrl === '';
            
            // If user is on login page but already authenticated, redirect them
            if (isOnLoginPage) {
              setTimeout(() => {
                if (profile.role === 'SUPER_ADMIN' || profile.role === 'HR') {
                  console.log('AuthService: Redirecting from login to hr-dashboard for role:', profile.role);
                  this.router.navigate(['/hr-dashboard']).catch(err => {
                    console.error('Navigation error:', err);
                  });
                } else {
                  this.router.navigate(['/']).catch(err => {
                    console.error('Navigation error:', err);
                  });
                }
              }, 100);
            }
            // If super admin/HR is on default route, redirect to hr-dashboard
            else if (isOnDefaultRoute && (profile.role === 'SUPER_ADMIN' || profile.role === 'HR')) {
              setTimeout(() => {
                console.log('AuthService: Redirecting super admin/HR from default route to hr-dashboard');
                this.router.navigate(['/hr-dashboard']).catch(err => {
                  console.error('Navigation error:', err);
                });
              }, 100);
            }
          });
        }
      }
    });
  }

  get currentUser$(): Observable<User | null | undefined> {
    return this._currentUser.asObservable().pipe(shareReplay(1));
  }

  get userProfile$(): Observable<any> {
    return this._userProfile.asObservable().pipe(
      distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
      shareReplay(1)
    );
  }

  get currentUserValue(): User | null | undefined {
    return this._currentUser.value;
  }

  async signIn(email: string) {
    this.loadingService.show();
    try {
      return await this.supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin
        }
      });
    } finally {
      this.loadingService.hide();
    }
  }

  async signInWithPassword(email: string, password: string) {
    this.loadingService.show();
    try {
      const result = await this.supabase.auth.signInWithPassword({
        email,
        password
      });
      // Don't hide loading here - let onAuthStateChange handle it after profile loads
      // This ensures loading stays visible until the full login flow completes
      // Only hide on error
      if (result.error) {
        this.loadingService.hide();
      }
      return result;
    } catch (error) {
      // Catch any unexpected errors and ensure loading is hidden
      this.loadingService.hide();
      throw error;
    }
  }

  async signUp(email: string, password: string, fullName?: string) {
    this.loadingService.show();
    try {
      return await this.supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName
          }
        }
      });
    } finally {
      this.loadingService.hide();
    }
  }

  async resetPassword(email: string) {
    // Supabase will append #type=recovery&access_token=... to the redirect URL
    // The login page will handle the URL params to show the reset password form
    this.loadingService.show();
    try {
      return await this.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`
      });
    } finally {
      this.loadingService.hide();
    }
  }

  async updatePassword(newPassword: string) {
    this.loadingService.show();
    try {
      return await this.supabase.auth.updateUser({
        password: newPassword
      });
    } finally {
      this.loadingService.hide();
    }
  }

  async verifyOtp(email: string, token: string) {
    this.loadingService.show();
    try {
      return await this.supabase.auth.verifyOtp({ email, token, type: 'email' });
    } finally {
      this.loadingService.hide();
    }
  }

  async signOut() {
    this.loadingService.show();
    try {
      return await this.supabase.auth.signOut();
    } finally {
      this.loadingService.hide();
    }
  }

  // Cache for user profile promise to handle concurrent requests
  private _profileLoadingPromise: Promise<any> | null = null;

  // Load and cache user profile
  async loadUserProfile(userId: string, showLoading: boolean = true) {
    // If we already have the profile for this user, don't fetch again unless forced
    if (this._userProfile.value && this._userProfile.value.id === userId) {
      return this._userProfile.value;
    }

    // If a request is already in progress, return that promise
    if (this._profileLoadingPromise) {
      return this._profileLoadingPromise;
    }

    // Start new request
    this._profileLoadingPromise = (async () => {
      if (showLoading) {
        this.loadingService.show();
      }
      try {
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
      } finally {
        this._profileLoadingPromise = null;
        if (showLoading) {
          this.loadingService.hide();
        }
      }
    })();

    return this._profileLoadingPromise;
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
