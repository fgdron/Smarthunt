/**
 * Tests — TutorialTooltip
 * Couvre : rendu conditionnel (visible/caché), contenu, bouton onDismiss
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Info } from 'lucide-react-native';
import TutorialTooltip from '@/components/TutorialTooltip';

// Evite les timers pendants de react-native/jest/setup.js après la suite
afterAll(() => { jest.clearAllTimers(); });

const defaultProps = {
  icon:      Info,
  title:     'Titre du tooltip',
  body:      'Corps du message explicatif.',
  onDismiss: jest.fn(),
};

// ── Visibilité ────────────────────────────────────────────────────────────────

describe('visibilité', () => {
  it('ne rend rien quand visible=false', () => {
    const { queryByText } = render(
      <TutorialTooltip {...defaultProps} visible={false} />
    );
    expect(queryByText('Titre du tooltip')).toBeNull();
  });

  it('rend le contenu quand visible=true', () => {
    const { getByText } = render(
      <TutorialTooltip {...defaultProps} visible={true} />
    );
    expect(getByText('Titre du tooltip')).toBeTruthy();
    expect(getByText('Corps du message explicatif.')).toBeTruthy();
  });
});

// ── Contenu ───────────────────────────────────────────────────────────────────

describe('contenu', () => {
  it('affiche le titre passé en prop', () => {
    const { getByText } = render(
      <TutorialTooltip {...defaultProps} visible={true} title="Mon titre custom" />
    );
    expect(getByText('Mon titre custom')).toBeTruthy();
  });

  it('affiche le body passé en prop', () => {
    const { getByText } = render(
      <TutorialTooltip {...defaultProps} visible={true} body="Description détaillée ici." />
    );
    expect(getByText('Description détaillée ici.')).toBeTruthy();
  });

  it(`affiche le bouton "J'ai compris"`, () => {
    const { getByText } = render(
      <TutorialTooltip {...defaultProps} visible={true} />
    );
    expect(getByText("J'ai compris")).toBeTruthy();
  });
});

// ── Interaction ───────────────────────────────────────────────────────────────

describe('interaction', () => {
  it('appelle onDismiss au tap sur le bouton CTA', () => {
    const onDismiss = jest.fn();
    const { getByText } = render(
      <TutorialTooltip {...defaultProps} visible={true} onDismiss={onDismiss} />
    );
    fireEvent.press(getByText("J'ai compris"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("n'appelle pas onDismiss si visible=false (composant non rendu)", () => {
    const onDismiss = jest.fn();
    render(<TutorialTooltip {...defaultProps} visible={false} onDismiss={onDismiss} />);
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
