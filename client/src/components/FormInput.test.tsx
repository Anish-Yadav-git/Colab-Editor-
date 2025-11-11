import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FormInput from './FormInput';

describe('FormInput', () => {
  it('renders input with label', () => {
    render(
      <FormInput
        label="Email"
        name="email"
        value=""
        onChange={() => {}}
      />
    );

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('displays required indicator when required', () => {
    render(
      <FormInput
        label="Email"
        name="email"
        value=""
        onChange={() => {}}
        required
      />
    );

    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('calls onChange when input value changes', () => {
    const handleChange = vi.fn();
    render(
      <FormInput
        label="Email"
        name="email"
        value=""
        onChange={handleChange}
      />
    );

    const input = screen.getByLabelText('Email');
    fireEvent.change(input, { target: { value: 'test@example.com' } });

    expect(handleChange).toHaveBeenCalled();
  });

  it('calls onBlur when input loses focus', () => {
    const handleBlur = vi.fn();
    render(
      <FormInput
        label="Email"
        name="email"
        value=""
        onChange={() => {}}
        onBlur={handleBlur}
      />
    );

    const input = screen.getByLabelText('Email');
    fireEvent.blur(input);

    expect(handleBlur).toHaveBeenCalled();
  });

  it('displays error message when error prop is provided', () => {
    render(
      <FormInput
        label="Email"
        name="email"
        value="invalid"
        onChange={() => {}}
        error="Please enter a valid email address"
      />
    );

    expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
  });

  it('applies error styling when error exists', () => {
    render(
      <FormInput
        label="Email"
        name="email"
        value="invalid"
        onChange={() => {}}
        error="Invalid email"
      />
    );

    const input = screen.getByLabelText('Email');
    expect(input).toHaveClass('form-input-error');
  });

  it('sets aria-invalid when error exists', () => {
    render(
      <FormInput
        label="Email"
        name="email"
        value="invalid"
        onChange={() => {}}
        error="Invalid email"
      />
    );

    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('sets aria-describedby when error exists', () => {
    render(
      <FormInput
        label="Email"
        name="email"
        value="invalid"
        onChange={() => {}}
        error="Invalid email"
      />
    );

    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-describedby', 'email-error');
  });

  it('renders with placeholder', () => {
    render(
      <FormInput
        label="Email"
        name="email"
        value=""
        onChange={() => {}}
        placeholder="Enter your email"
      />
    );

    expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument();
  });

  it('disables input when disabled prop is true', () => {
    render(
      <FormInput
        label="Email"
        name="email"
        value=""
        onChange={() => {}}
        disabled
      />
    );

    const input = screen.getByLabelText('Email');
    expect(input).toBeDisabled();
  });

  it('sets input type correctly', () => {
    render(
      <FormInput
        label="Password"
        name="password"
        type="password"
        value=""
        onChange={() => {}}
      />
    );

    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
  });

  it('sets autoComplete attribute', () => {
    render(
      <FormInput
        label="Email"
        name="email"
        value=""
        onChange={() => {}}
        autoComplete="email"
      />
    );

    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('autocomplete', 'email');
  });

  it('displays current value', () => {
    render(
      <FormInput
        label="Email"
        name="email"
        value="test@example.com"
        onChange={() => {}}
      />
    );

    const input = screen.getByLabelText('Email') as HTMLInputElement;
    expect(input.value).toBe('test@example.com');
  });
});
