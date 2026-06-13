/**
 * Payment UI Module
 * Handles payment method selection and checkout UI
 */

class PaymentUI {
  constructor() {
    this.selectedMethod = 'cash'; // default
    this.isProcessing = false;
    this.init();
  }

  init() {
    this.setupPaymentMethodButtons();
    this.setupPaymentModal();
  }

  /**
   * Setup payment method selection buttons
   */
  setupPaymentMethodButtons() {
    const methodButtons = document.querySelectorAll('[data-payment-method]');
    methodButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        methodButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedMethod = btn.dataset.paymentMethod;
        this.updatePaymentForm();
      });
    });
  }

  /**
   * Setup payment modal
   */
  setupPaymentModal() {
    const modal = document.getElementById('paymentModal');
    if (modal) {
      const closeBtn = modal.querySelector('.close-btn');
      closeBtn?.addEventListener('click', () => this.closeModal());
    }
  }

  /**
   * Open payment modal
   * @param {number} amount - Amount to pay
   */
  openPaymentModal(amount) {
    const modal = document.getElementById('paymentModal');
    if (!modal) {
      console.error('Payment modal not found');
      return;
    }

    document.getElementById('paymentAmount').textContent = formatCurrency(amount);
    modal.classList.remove('hidden');
    this.updatePaymentForm();
  }

  /**
   * Close payment modal
   */
  closeModal() {
    const modal = document.getElementById('paymentModal');
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  /**
   * Update payment form based on selected method
   */
  updatePaymentForm() {
    const mpesaForm = document.getElementById('mpesaForm');
    const stripeForm = document.getElementById('stripeForm');
    const cashForm = document.getElementById('cashForm');

    // Hide all forms
    [mpesaForm, stripeForm, cashForm].forEach(f => {
      if (f) f.classList.add('hidden');
    });

    // Show selected form
    switch (this.selectedMethod) {
      case 'mpesa':
        if (mpesaForm) mpesaForm.classList.remove('hidden');
        break;
      case 'stripe':
        if (stripeForm) stripeForm.classList.remove('hidden');
        break;
      case 'cash':
      default:
        if (cashForm) cashForm.classList.remove('hidden');
        break;
    }
  }

  /**
   * Process M-Pesa payment
   * @param {string} phoneNumber - Customer phone number
   * @param {number} amount - Amount to pay
   * @param {function} onSuccess - Success callback
   * @param {function} onError - Error callback
   */
  async processMpesa(phoneNumber, amount, onSuccess, onError) {
    if (this.isProcessing) return;

    try {
      this.isProcessing = true;
      this.showLoading(true);

      // Validate phone
      if (!phoneNumber || phoneNumber.trim().length < 10) {
        throw new Error('Please enter a valid phone number');
      }

      // Initiate M-Pesa payment
      const response = await fetch('/api/payments/mpesa/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber,
          amount,
          accountRef: `ORD-${Date.now()}`,
          description: 'POS Sale Payment',
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to initiate M-Pesa payment');
      }

      // Show prompt to user
      this.showMpesaPrompt(data.message);

      // Poll for payment confirmation
      const maxAttempts = 30; // 30 seconds
      let attempts = 0;

      const pollPayment = setInterval(async () => {
        attempts++;

        const statusResponse = await fetch('/api/payments/mpesa/query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            checkoutRequestId: data.checkoutRequestId,
          }),
        });

        const statusData = await statusResponse.json();

        if (statusData.success) {
          clearInterval(pollPayment);
          this.showLoading(false);
          this.isProcessing = false;
          onSuccess({
            method: 'MPESA',
            reference: statusData.mpesaReceiptNumber,
            amount,
          });
        } else if (attempts >= maxAttempts) {
          clearInterval(pollPayment);
          this.showLoading(false);
          this.isProcessing = false;
          onError('Payment timeout. Please try again.');
        }
      }, 1000);
    } catch (error) {
      console.error('M-Pesa payment error:', error);
      this.showLoading(false);
      this.isProcessing = false;
      onError(error.message);
    }
  }

  /**
   * Process Stripe payment (requires Stripe.js)
   * @param {object} stripe - Stripe instance
   * @param {object} elements - Stripe elements
   * @param {number} amount - Amount to pay
   * @param {function} onSuccess - Success callback
   * @param {function} onError - Error callback
   */
  async processStripe(stripe, elements, amount, onSuccess, onError) {
    if (this.isProcessing || !stripe || !elements) return;

    try {
      this.isProcessing = true;
      this.showLoading(true);

      // Create payment intent
      const intentResponse = await fetch('/api/payments/stripe/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          description: 'POS Sale',
        }),
      });

      const intentData = await intentResponse.json();

      if (!intentData.success) {
        throw new Error(intentData.error || 'Failed to create payment intent');
      }

      // Confirm payment with Stripe
      const cardElement = elements.getElement('card');
      const { error, paymentIntent } = await stripe.confirmCardPayment(
        intentData.clientSecret,
        {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: 'Customer',
            },
          },
        }
      );

      this.showLoading(false);
      this.isProcessing = false;

      if (error) {
        onError(error.message);
      } else if (paymentIntent.status === 'succeeded') {
        onSuccess({
          method: 'STRIPE',
          reference: paymentIntent.id,
          amount,
        });
      } else {
        onError('Payment failed');
      }
    } catch (error) {
      console.error('Stripe payment error:', error);
      this.showLoading(false);
      this.isProcessing = false;
      onError(error.message);
    }
  }

  /**
   * Process cash payment
   * @param {number} amount - Amount due
   * @param {number} tendered - Amount tendered by customer
   * @param {function} onSuccess - Success callback
   */
  processCash(amount, tendered, onSuccess) {
    const change = tendered - amount;

    if (change < 0) {
      alert(`Insufficient payment. Short by ${formatCurrency(Math.abs(change))}`);
      return;
    }

    onSuccess({
      method: 'CASH',
      reference: `CASH-${Date.now()}`,
      amount,
      tendered,
      change,
    });
  }

  /**
   * Show M-Pesa prompt message
   * @param {string} message - Message to display
   */
  showMpesaPrompt(message) {
    const promptEl = document.getElementById('mpesaPrompt');
    if (promptEl) {
      promptEl.textContent = message || 'Enter your M-Pesa PIN on your phone';
      promptEl.classList.remove('hidden');
    }
  }

  /**
   * Show/hide loading indicator
   * @param {boolean} show - Show or hide
   */
  showLoading(show) {
    const loader = document.getElementById('paymentLoader');
    if (loader) {
      loader.classList.toggle('hidden', !show);
    }
  }

  /**
   * Format currency for display (helper)
   * @param {number} amount - Amount
   * @returns {string} Formatted string
   */
  formatCurrency(amount) {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(amount);
  }
}

// Global instance
const paymentUI = new PaymentUI();
