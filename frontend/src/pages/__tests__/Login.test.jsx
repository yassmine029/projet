import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import '@testing-library/jest-dom'
import Login from '../Login'

vi.mock('../../api', () => ({
  register: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  adminPortalLogin: vi.fn(),
}))
import { register, login } from '../../api'

function renderLogin(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

/** Remplit les champs obligatoires d’inscription hors email / mot de passe. */
function fillSignupMandatoryExcludingCredentials() {
  fireEvent.change(screen.getByPlaceholderText('Votre nom'), { target: { value: 'Dupont' } })
  fireEvent.change(screen.getByPlaceholderText('Votre prénom'), { target: { value: 'Jean' } })
  const affiliationEl = document.getElementById('signup-affiliation')
  if (!affiliationEl) throw new Error('signup-affiliation introuvable')
  fireEvent.change(affiliationEl, { target: { value: 'CHU de Monastir' } })
  fireEvent.change(screen.getByPlaceholderText('12345 ou T-12345'), { target: { value: '12345' } })
  const checkboxes = screen.getAllByRole('checkbox')
  expect(checkboxes.length).toBeGreaterThanOrEqual(2)
  fireEvent.click(checkboxes[0])
  fireEvent.click(checkboxes[1])
}

describe('Login page', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(global, 'alert').mockImplementation(() => {})
  })

  it('shows email error on invalid email for signup', async () => {
    renderLogin(<Login onLogin={vi.fn()} />)
    fireEvent.click(screen.getByText('Inscription'))
    fillSignupMandatoryExcludingCredentials()

    const emailInput = screen.getByPlaceholderText('votre.email@hopital.com')
    fireEvent.focus(emailInput)
    fireEvent.change(emailInput, { target: { value: 'not-an-email' } })

    const passwordInput = screen.getByPlaceholderText('••••••••••')
    fireEvent.focus(passwordInput)
    fireEvent.change(passwordInput, { target: { value: 'ValidPass1!' } })

    const form = emailInput.closest('form')
    expect(form).toBeTruthy()
    form.noValidate = true
    fireEvent.submit(form)

    expect(await screen.findByText('Email invalide')).toBeInTheDocument()
  })

  it('shows password error on short password for signup', async () => {
    renderLogin(<Login onLogin={vi.fn()} />)
    fireEvent.click(screen.getByText('Inscription'))
    fillSignupMandatoryExcludingCredentials()

    const emailInput = screen.getByPlaceholderText('votre.email@hopital.com')
    fireEvent.focus(emailInput)
    fireEvent.change(emailInput, { target: { value: 'a@hopital.com' } })

    const passwordInput = screen.getByPlaceholderText('••••••••••')
    fireEvent.focus(passwordInput)
    fireEvent.change(passwordInput, { target: { value: 'short' } })

    fireEvent.click(screen.getByRole('button', { name: /Créer mon compte/i }))

    expect(await screen.findByText(/Minimum 8 caractères/)).toBeInTheDocument()
  })

  it('calls register and returns to Connexion tab on register success', async () => {
    register.mockResolvedValue({ data: { ok: true } })
    renderLogin(<Login onLogin={vi.fn()} />)
    fireEvent.click(screen.getByText('Inscription'))
    fillSignupMandatoryExcludingCredentials()

    fireEvent.focus(screen.getByPlaceholderText('votre.email@hopital.com'))
    fireEvent.change(screen.getByPlaceholderText('votre.email@hopital.com'), {
      target: { value: 'test.chu@hopital.com' },
    })
    fireEvent.focus(screen.getByPlaceholderText('••••••••••'))
    fireEvent.change(screen.getByPlaceholderText('••••••••••'), { target: { value: 'LongPass1!' } })

    fireEvent.click(screen.getByRole('button', { name: /Créer mon compte/i }))

    await waitFor(() => expect(register).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: /Se connecter/i })).toBeInTheDocument()
  })

  it('calls onLogin on successful login and shows success message', async () => {
    const mockUser = { username: 'a@hopital.com' }
    login.mockResolvedValue({ data: { ok: true, user: mockUser } })
    const onLogin = vi.fn()
    renderLogin(<Login onLogin={onLogin} />)

    fireEvent.focus(screen.getByPlaceholderText('nom@hopital.com'))
    fireEvent.change(screen.getByPlaceholderText('nom@hopital.com'), { target: { value: 'a@hopital.com' } })
    fireEvent.focus(screen.getByPlaceholderText('••••••••'))
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'validpassword' } })
    fireEvent.click(screen.getByRole('button', { name: /Se connecter/i }))

    await waitFor(() => expect(login).toHaveBeenCalled())
    expect(onLogin).toHaveBeenCalledWith(mockUser)
    expect(screen.getByText(/Connexion réussie/)).toBeInTheDocument()
  })
})
