import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { MessagesModule } from 'primeng/messages';
import { CheckboxModule } from 'primeng/checkbox';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    MessagesModule,
    CheckboxModule
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  email: string = '';
  password: string = '';
  loading: boolean = false;
  messages: any[] = [];
  isSignUp: boolean = false;
  fullName: string = '';
  rememberMe: boolean = false;
  showForgotPassword: boolean = false;
  isPasswordReset: boolean = false;
  newPassword: string = '';
  confirmPassword: string = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) { }

  ngOnInit() {
    // Check if this is a password reset flow
    // Supabase can put params in either the query string or the URL hash
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));

    const type = urlParams.get('type') || hashParams.get('type');

    if (type === 'recovery') {
      this.isPasswordReset = true;
      this.messages = [{
        severity: 'info',
        summary: 'Reset Your Password',
        detail: 'Please enter your new password below'
      }];
    }
  }

  async handleLogin() {
    this.loading = true;
    this.messages = [];

    try {
      if (this.isSignUp) {
        const { data, error } = await this.authService.signUp(
          this.email,
          this.password,
          this.fullName
        );

        if (error) throw error;

        this.messages = [{
          severity: 'success',
          summary: 'Success',
          detail: 'Account created! Please check your email to verify your account.'
        }];

        setTimeout(() => {
          this.isSignUp = false;
          this.messages = [];
        }, 3000);
      } else {
        const { data, error } = await this.authService.signInWithPassword(
          this.email,
          this.password
        );

        if (error) throw error;
      }
    } catch (error: any) {
      this.messages = [{
        severity: 'error',
        summary: 'Error',
        detail: error.message || 'Authentication failed'
      }];
    } finally {
      this.loading = false;
    }
  }

  toggleMode() {
    this.isSignUp = !this.isSignUp;
    this.messages = [];
    this.password = '';
  }

  async handleForgotPassword() {
    if (!this.email) {
      this.messages = [{
        severity: 'warn',
        summary: 'Email Required',
        detail: 'Please enter your email address'
      }];
      return;
    }

    this.loading = true;
    this.messages = [];

    try {
      const { error } = await this.authService.resetPassword(this.email);
      if (error) throw error;

      this.messages = [{
        severity: 'success',
        summary: 'Email Sent',
        detail: 'Check your email for password reset instructions'
      }];

      this.showForgotPassword = false;
    } catch (error: any) {
      this.messages = [{
        severity: 'error',
        summary: 'Error',
        detail: error.message || 'Failed to send reset email'
      }];
    } finally {
      this.loading = false;
    }
  }

  async handlePasswordUpdate() {
    if (this.newPassword !== this.confirmPassword) {
      this.messages = [{
        severity: 'error',
        summary: 'Error',
        detail: 'Passwords do not match'
      }];
      return;
    }

    if (this.newPassword.length < 6) {
      this.messages = [{
        severity: 'error',
        summary: 'Error',
        detail: 'Password must be at least 6 characters'
      }];
      return;
    }

    this.loading = true;
    this.messages = [];

    try {
      const { data, error } = await this.authService.updatePassword(this.newPassword);
      if (error) throw error;

      this.messages = [{
        severity: 'success',
        summary: 'Success',
        detail: 'Password updated successfully! Redirecting...'
      }];

      setTimeout(() => {
        this.isPasswordReset = false;
        this.router.navigate(['/']);
      }, 2000);
    } catch (error: any) {
      this.messages = [{
        severity: 'error',
        summary: 'Error',
        detail: error.message || 'Failed to update password'
      }];
    } finally {
      this.loading = false;
    }
  }
}
