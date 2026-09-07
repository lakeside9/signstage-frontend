import React from 'react';

type Props = {
  children: React.ReactNode;
  resetKey: number;
  onError: () => void;
};

type State = { failed: boolean };

export class EffectPreviewErrorBoundary extends React.Component<Props, State> {
  public state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.warn('Effect preview renderer failed.', error, info);
    this.props.onError();
  }

  componentDidUpdate(previousProps: Props) {
    if (this.state.failed && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
