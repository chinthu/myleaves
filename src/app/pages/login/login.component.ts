import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessagesModule } from 'primeng/messages';
// import { Message } from 'primeng/api'; // Removed to avoid type error

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, CardModule, ButtonModule, InputTextModule, MessagesModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  email: string = '';
  loading: boolean = false;
  messages: any[] = []; // Use any[] to avoid type issues

  // For OTP verification (simplified flow for now, can be expanded)
  otpSent: boolean = false;

  constructor(private authService: AuthService) { }

  async handleLogin() {
    this.loading = true;
    this.messages = [];

    try {
      const { error } = await this.authService.signIn(this.email);
      if (error) throw error;
      this.otpSent = true;
    } catch (error: any) {
      this.messages = [{ severity: 'error', summary: 'Error', detail: error.message || 'Failed to send login link' }];
    } finally {
      this.loading = false;
    }
  }
}
