import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Modelisation3D from '../Modelisation3D'

vi.mock('../../api', () => ({
  default: {
    get: vi.fn(() => Promise.reject(new Error('unmocked GET'))),
    post: vi.fn(),
    defaults: { baseURL: '' },
  },
}))

import api from '../../api'

describe('Emergency session UI (modelisation 3D)', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        run: { id: 42, patient: 1, threshold: 0.75 },
      },
    })
  })

  it('hides dashboard link "Analyses MRI" when user is emergency session', async () => {
    render(
      <MemoryRouter initialEntries={['/segmentation/modelisation?run=42']}>
        <Modelisation3D user={{ is_emergency_session: true }} />
      </MemoryRouter>
    )

    expect(screen.queryByRole('button', { name: /Analyses MRI/i })).not.toBeInTheDocument()
  })

  it('shows "Analyses MRI" for a normal session', async () => {
    render(
      <MemoryRouter initialEntries={['/segmentation/modelisation?run=42']}>
        <Modelisation3D user={{ is_emergency_session: false }} />
      </MemoryRouter>
    )

    expect(await screen.findByRole('button', { name: /Analyses MRI/i })).toBeInTheDocument()
  })
})
