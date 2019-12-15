import Album from './library/Album';
import Artist from './library/Artist';
import PropTypes from 'prop-types';
import React from 'react';
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

  onClick(evt, suggestion) {
    this.setState({
      activeSuggestion: 0,
      filteredSuggestions: [suggestion],
      showSuggestion: false,
      userInput: evt.target.innerText,
    });
  }

  onSubmit() {
    const suggestion = this.state.filteredSuggestions[
      this.state.activeSuggestion];
    if (suggestion) {
      this.props.onSubmit(suggestion);
      this.setState({
        userInput: "",
      });
    }
    // TODO: else if (this.props.addNew)
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
                key={suggestion.id || suggestion}
                onClick={(evt) => this.onClick(evt, suggestion)}
              >
                {this.props.getDisplayName(suggestion)}
              </li>
            );
          })
        }
      </ul>
    );
  }

  onKeyDown(evt) {
    const suggestion = this.state.filteredSuggestions[
      this.state.activeSuggestion];
    switch (evt.keyCode) {
    //enter
    case 13:
      // double tap enter to submit
      if (this.state.filteredSuggestions.length === 1 &&
          !this.state.showSuggestion) {
        this.onSubmit();
      } else if (suggestion) {
        this.setState({
          activeSuggestion: 0,
          showSuggestion: false,
          filteredSuggestions: [suggestion],
          userInput: this.props.getDisplayName(suggestion),
        });
      } else {
        // if has add func, call it, else show warning?
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


  onChange(evt) {
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

  render() {
    return (
      <>
        <input
          className="serach-input"
          onChange={this.onChange.bind(this)}
          onKeyDown={this.onKeyDown.bind(this)}
          type="text"
          value={this.state.userInput}
        />
        {
          this.getSearchSuggestions()
        }
        <button onClick={this.onSubmit.bind(this)}>
          Add
        </button>
      </>
    );
  }
}

AutoComplete.propTypes = {
  getDisplayName: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  searchFilter: PropTypes.func.isRequired,
  suggestions: PropTypes.arrayOf(PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
    PropTypes.instanceOf(Album),
    PropTypes.instanceOf(Artist),
  ]).isRequired),
};
