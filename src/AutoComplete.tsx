import './AutoComplete.css';
import React, {ChangeEvent, KeyboardEvent, MouseEvent} from 'react';

interface AutoCompleteProps {
  suggestions: string[];
  getDisplayName(id: string): string;
  onSubmit(id: string): void;
  searchFilter(search: string, id: string): boolean;
}

interface AutoCompleteState {
  filteredSuggestions: string[];
  activeSuggestion: number;
  showSuggestion: boolean;
  userInput: string;
}

export default class AutoComplete extends React.Component<AutoCompleteProps, AutoCompleteState> {
  constructor(props: AutoCompleteProps) {
    super(props);

    this.state = {
      activeSuggestion: 0,
      filteredSuggestions: [],
      showSuggestion: false,
      userInput: '',
    };
  }

  public render(): JSX.Element {
    return (
      <>
        <input
          className="serach-input"
          onChange={this.onChange.bind(this)}
          onKeyDown={this.onKeyDown.bind(this)}
          type="text"
          value={this.state.userInput}
        />
        {this.getSearchSuggestions()}
        <button onClick={this.onSubmit.bind(this)}>Add</button>
      </>
    );
  }

  private onClick(evt: MouseEvent, suggestion: string): void {
    this.setState({
      activeSuggestion: 0,
      filteredSuggestions: [suggestion],
      showSuggestion: false,
      userInput: (evt.target as HTMLInputElement).innerText,
    });
  }

  private onSubmit(): void {
    const suggestion = this.state.filteredSuggestions[
      this.state.activeSuggestion];
    if (suggestion) {
      this.props.onSubmit(suggestion);
      this.setState({userInput: ''});
    }
    // TODO: else if (this.props.addNew)
  }

  private getSearchSuggestions(): JSX.Element | undefined {
    if (!this.state.showSuggestion || !this.state.filteredSuggestions.length ||
      !this.state.userInput) {
      return;
    }
    return (
      <ul className="suggestions">
        {
          this.state.filteredSuggestions.map((suggestion, index) => {
            return (
              <li
                className={this.state.activeSuggestion === index ? 'active' : ''}
                key={suggestion}
                onClick={(evt: MouseEvent) => this.onClick(evt, suggestion)}
              >
                {this.props.getDisplayName(suggestion)}
              </li>
            );
          })
        }
      </ul>
    );
  }

  private onKeyDown(evt: KeyboardEvent): void {
    const suggestion = this.state.filteredSuggestions[
      this.state.activeSuggestion];
    switch (evt.keyCode) {
    // enter
    case 13:
      // double tap enter to submit
      if (this.state.filteredSuggestions.length === 1 &&
          !this.state.showSuggestion) {
        this.onSubmit();
      } else if (suggestion) {
        this.setState({
          activeSuggestion: 0,
          filteredSuggestions: [suggestion],
          showSuggestion: false,
          userInput: this.props.getDisplayName(suggestion),
        });
      } else {
        // if has add func, call it, else show warning?
      }
      break;
    // up arrow
    case 38:
      this.setState({activeSuggestion: Math.max(0, this.state.activeSuggestion - 1)});
      break;
    // down arrow
    case 40:
      this.setState({
        activeSuggestion: Math.min(this.state.filteredSuggestions.length,
          this.state.activeSuggestion + 1),
      });
      break;
    default:
      // no other special keys for now
      break;
    }
  }

  private onChange(evt: ChangeEvent<HTMLInputElement>): void {
    const input = evt.currentTarget.value;
    // TODO: sort by relavece / starting with right letter
    const suggestions = this.props.suggestions.filter((suggest) => {
      return this.props.searchFilter(input, suggest);
    });
    this.setState({
      activeSuggestion: 0,
      filteredSuggestions: suggestions,
      showSuggestion: true,
      userInput: input,
    });
  }
}
