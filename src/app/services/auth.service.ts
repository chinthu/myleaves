import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { BehaviorSubject, Observable } from 'rxjs';
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
      if (event === 'SIGNED_IN' && session) {
        this._currentUser.next(session.user);
        this.loadUserProfile(session.user.id);

        // Only redirect if we are not already on the home page to avoid loops or unnecessary navs
        if (this.router.url === '/login') {
          this.router.navigate(['/']);
        }
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
    return this._currentUser.asObservable();
  }

  get userProfile$(): Observable<any> {
    return this._userProfile.asObservable();
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
