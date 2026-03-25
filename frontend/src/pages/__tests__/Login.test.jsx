import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import Login from '../Login'

// Mock api module
vi.mock('../../api', () => ({
  register: vi.fn(),
  login: vi.fn()
}))
import { register, login } from '../../api'

describe('Login page', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // mock alert to avoid real dialogs
    vi.spyOn(global, 'alert').mockImplementation(() => {})
  })

  it('shows email error on invalid email for signup', async () => {
    render(<Login onLogin={vi.fn()} />)
    // switch to signup
    fireEvent.click(screen.getByText('Inscription'))
    // fill invalid email
    fireEvent.change(screen.getByPlaceholderText('votre@email.com'), { target: { value: 'not-an-email' } })
    fireEvent.change(screen.getByPlaceholderText('Dr. Jean Dupont'), { target: { value: 'Dr X' } })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'longenough' } })
    fireEvent.click(screen.getByRole('button', { name: /Créer un compte/i }))

    expect(await screen.findByText('Email invalide')).toBeInTheDocument()
  })

  it('shows password error on short password for signup', async () => {
    render(<Login onLogin={vi.fn()} />)
    fireEvent.click(screen.getByText('Inscription'))
    fireEvent.change(screen.getByPlaceholderText('votre@email.com'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByPlaceholderText('Dr. Jean Dupont'), { target: { value: 'Dr X' } })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'short' } })
    fireEvent.click(screen.getByRole('button', { name: /Créer un compte/i }))

    expect(await screen.findByText('Le mot de passe doit contenir au moins 8 caractères')).toBeInTheDocument()
  })

  it('shows success and toggles back to login on register success', async () => {
    register.mockResolvedValue({ data: { ok: true } })
    render(<Login onLogin={vi.fn()} />)
    fireEvent.click(screen.getByText('Inscription'))
    fireEvent.change(screen.getByPlaceholderText('votre@email.com'), { target: { value: 'test@x.com' } })
    fireEvent.change(screen.getByPlaceholderText('Dr. Jean Dupont'), { target: { value: 'Dr X' } })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'longenough' } })
    fireEvent.click(screen.getByRole('button', { name: /Créer un compte/i }))

    await waitFor(() => expect(register).toHaveBeenCalled())
    // after success, the form should switch back to sign-in (submit button text is "Se connecter")
    expect(screen.getByRole('button', { name: /Se connecter/i })).toBeInTheDocument()
    // and success message under full name should appear
    expect(screen.getByText(/Compte créé/)).toBeInTheDocument()
  })

  it('calls onLogin on successful login and shows password success', async () => {
    const mockUser = { username: 'a@b.com' }
    login.mockResolvedValue({ data: { ok: true, user: mockUser } })
    const onLogin = vi.fn()
    render(<Login onLogin={onLogin} />)
    fireEvent.change(screen.getByPlaceholderText('votre@email.com'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'validpassword' } })
    fireEvent.click(screen.getByRole('button', { name: /Se connecter/i }))

    await waitFor(() => expect(login).toHaveBeenCalled())
    expect(onLogin).toHaveBeenCalledWith(mockUser)
    expect(screen.getByText(/Connecté/)).toBeInTheDocument()
  })
})