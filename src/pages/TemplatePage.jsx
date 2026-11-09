import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TemplatePreview from '../components/TemplatePreview.jsx'
import { TEMPLATES } from '../data/templates.js'
import { getTemplateId, setTemplateId } from '../lib/session.js'
import CancelButton from '../components/CancelButton.jsx'

export default function TemplatePage() {
  const navigate = useNavigate()
  const [selectedId, setSelectedId] = useState(() => getTemplateId() ?? TEMPLATES[0].id)
  const selected = TEMPLATES.find((t) => t.id === selectedId)

  const choose = (id) => {
    setSelectedId(id)
    setTemplateId(id)
  }

  const next = () => {
    setTemplateId(selectedId)
    navigate('/booth', { state: { templateId: selectedId } })
  }

  return (
    <main className="page page--template">
      <header className="topbar">
        <CancelButton />
        <span className="topbar__brand">Come Alive PhotoBooth</span>
        <span className="topbar__step">1 / 3</span>
      </header>

      <div className="page__intro">
        <h1 className="page__title">Choose a Template</h1>
        <p className="page__sub">Pick your favorite frame for your photo strip</p>
        <p className="tpl-hint">Swipe to see all designs</p>
      </div>

      <div className="tpl-grid" role="radiogroup" aria-label="Photo strip templates">
        {TEMPLATES.map((t, i) => {
          const isSel = t.id === selectedId
          return (
            <label
              key={t.id}
              className={`tpl-option${isSel ? ' is-selected' : ''}`}
              style={{ '--i': i }}
            >
              <input
                type="radio"
                name="template"
                value={t.id}
                checked={isSel}
                onChange={() => choose(t.id)}
              />
              <TemplatePreview template={t} />
              <span className="tpl-option__name">{t.name}</span>
              <span className="tpl-option__check" aria-hidden="true">
                ✓
              </span>
            </label>
          )
        })}
      </div>

      <div className="actionbar">
        <p className="actionbar__info" aria-live="polite">
          <span>Selected template</span>
          <strong>
            {selected.name}
          </strong>
        </p>
        <button type="button" className="cta cta--sm" onClick={next}>
          Next
        </button>
      </div>
    </main>
  )
}
