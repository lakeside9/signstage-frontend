import React from 'react';

type Props = {
  children: React.ReactNode;
  requestId?: string;
  onError?: (requestId: string) => void;
};

type State = {
  failed: boolean;
};

export class ProjectorEffectsBoundary extends React.Component<Props, State> {
  public state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.warn('Projector effects disabled after a rendering error.', error, info);
    if (this.props.requestId) this.props.onError?.(this.props.requestId);
  }

  componentDidUpdate(previousProps: Props) {
    if (this.state.failed && previousProps.requestId !== this.props.requestId) {
      this.setState({ failed: false });
    }
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
