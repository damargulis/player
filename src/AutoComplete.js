
import React, {Fragment} from 'react';

import './AutoComplete.css';

export default class AutoComplete extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      activeSuggestion: 0,
      filteredSuggestions: [],
      showSuggestion: false,
      userInput: "",
    };
  }

  onClick(evt) {
    this.setState({
      activeSuggestion: 0,
      filteredSuggestions: [],
      showSuggestion: false,
      userInput: evt.target.innerText,
    });
  }

  getSearchSuggestions() {
    if (!this.state.showSuggestion || !this.state.filteredSuggestions.length ||
      !this.state.userInput) {
      return null;
    }
    return (
      <ul className="suggestions">
        {
          this.state.filteredSuggestions.map((suggestion, index) => {
            return (
              <li
                className={
                  this.state.activeSuggestion === index ? "active" : ""
                }
                key={index}
                onClick={this.onClick.bind(this)}
              >
                {suggestion}
              </li>
            );
          })
        }
      </ul>
    );
  }

  onChange(evt) {
    const input = evt.currentTarget.value;
    const suggestions = this.props.suggestions.filter((suggest) => {
      return suggest.toLowerCase().indexOf(input.toLowerCase()) > -1;
    });
    this.setState({
      activeSuggestion: 0,
      filteredSuggestions: suggestions,
      showSuggestion: true,
      userInput: input,
    });
  }

  onKeyDown(evt) {
    const suggestion = this.state.filteredSuggestions[
      this.state.activeSuggestion];
    switch (evt.keyCode) {
    //enter
    case 13:
      // if input already == suggestion, do submit action
      if (suggestion === this.state.userInput) {
        this.onSubmit();
      } else {
        this.setState({
          activeSuggestion: 0,
          showSuggestion: false,
          userInput: suggestion,
        });
      }
      break;
    // up arrow
    case 38:
      this.setState({
        activeSuggestion: Math.max(0, this.state.activeSuggestion - 1),
      });
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

  onSubmit() {
    this.props.onSubmit(this.state.userInput);
    this.setState({
      userInput: "",
    });
  }

  render() {
    return (
      <Fragment>
        <input
          className="serach-input"
          type="text"
          onChange={this.onChange.bind(this)}
          onKeyDown={this.onKeyDown.bind(this)}
          value={this.state.userInput}
        />
        {
          this.getSearchSuggestions()
        }
        <button onClick={this.onSubmit.bind(this)}>
          Add
        </button>
      </Fragment>
    );
  }
}

