---
title: "Mastodon API - Tags and Filters - Part One"
subtitle: "The first post in the series on Mastodon"
date: 2022-12-02T20:32:43+11:00
lastmod: 2022-12-02T20:32:43+11:00
author: Sam McLeod
description: "Playing around with the Mastodon API"
keywords: ["mastodon", "golang", "scripting", "go", "api"]

tags: ["mastodon", "golang", "scripting", "go", "api", "openai", "ML", "AI"]
categories: ["Mastodon", "Scripting", "Machine learning"]
series: ["Mastodon"]

images: [""] #TODO:
featuredimage: ""
featuredImagePreview: ""

hiddenFromHomePage: true
hiddenFromSearch: false
norss: true

toc:
  enable: true
  auto: false

code:
  copy: true
  maxShownLines: 2000
math: false
lightgallery: false
readingTime: false
showFullContent: false
asciinema: false

draft: false
---

Mastodon API - Tags and Filters - Part One

**This post is a work in progress**

---

Todo - actually describe what I'm upto here 😅.

This post is a bit of a place holder - I'll update it in the next for days with more information.


# Golang

{{< code-block font-size="12pt" language="go" >}}
package main

// Used for importing and exporting Mastodon Filters and Tags
// This program was written by Sam McLeod, 2022

import (
	"bufio"
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/pmezard/go-difflib/difflib"
)

// MastodonConfig contains the configuration for connecting to a Mastodon instance.
type MastodonConfig struct {
	InstanceURL  string `json:"instance_url"`
	AccessToken  string `json:"access_token"`
	FilterExport string `json:"filters_export"`
	FilterImport string `json:"filters_import"`
	FilterURL    string `json:"filters_url"`
	TagsExport   string `json:"tags_export"`
	TagsImport   string `json:"tags_import"`
	TagsURL      string `json:"tags_url"`
}

// loadConfig loads the configuration from the specified file.
func loadConfig(file string) (*MastodonConfig, error) {
	// Read the file contents.
	data, err := ioutil.ReadFile(file)
	if err != nil {
		return nil, fmt.Errorf("error reading file: %w", err)
	}

	// ignore comments in the config file
	data = bytes.ReplaceAll(data, []byte("#"), []byte(""))

	// Unmarshal the JSON(5) data
	var config MastodonConfig
	if err := json.Unmarshal(data, &config); err != nil {
		// print the error and the line number
		if syntaxError, ok := err.(*json.SyntaxError); ok {
			reader := bytes.NewReader(data)
			scanner := bufio.NewScanner(reader)
			line := 1
			for scanner.Scan() {
				if int(syntaxError.Offset) < len(scanner.Bytes()) {
					// print the line before the error
					if line > 1 {
						fmt.Printf("%d: %s (before)\n", line-1, scanner.Text())
					}
					fmt.Printf("error parsing config file: %s at line %d", err, line)
					break
				}
				line++
			}
		}

	return nil, fmt.Errorf("error passing config file JSON: %w", err)
	}


	// Validate the configuration.
	if config.InstanceURL == "" {
		return nil, fmt.Errorf("missing instance_url in configuration")
	}
	if config.AccessToken == "" {
		return nil, fmt.Errorf("missing access_token in configuration")
	}

	return &config, nil

}

// exportFilters exports the user's filters using the specified configuration.
func exportFilters(config *MastodonConfig) error {
	// Check if the export directory is specified.
	if config.FilterExport == "" {
	return fmt.Errorf("missing filters_export in configuration")
	}

	// Create the export directory if it does not exist.
	if err := os.MkdirAll(config.FilterExport, 0755); err != nil {
		return fmt.Errorf("error creating export directory: %w", err)
	}

	// Download the user's current filters.
	filters, err := downloadFilters(config)
	if err != nil {
		return fmt.Errorf("error downloading filters: %w", err)
	}

	// unmarshal the array of filters
	var filtersArray []map[string]interface{}
	if err := json.Unmarshal(filters, &filtersArray); err != nil {
		return fmt.Errorf("error parsing filters: %w", err)
	}

	// create a map of filters by title.
	filterMap := make(map[string]map[string]interface{})
	for _, filter := range filtersArray {
		filterMap[filter["title"].(string)] = filter
	}

	// Create a map of filters by ID.
	filterIDMap := make(map[string]map[string]interface{})
	for _, filter := range filterMap {
		filterIDMap[filter["id"].(string)] = filter
	}

	// Using the map of filters by title, export each filter to a file with the title as the filename.
	for _, filter := range filterMap {
		// Get the filter title.
		title := filter["title"].(string)
		// Get the filter keywords.
		keywords := filter["keywords"].([]interface{})
		// Create a map of keywords by ID.
		keywordMap := make(map[string]map[string]interface{})
		for _, keyword := range keywords {
			keywordMap[keyword.(map[string]interface{})["id"].(string)] = keyword.(map[string]interface{})
		}
		// Create a map of keywords by keyword.
		keywordKeywordMap := make(map[string]map[string]interface{})
		for _, keyword := range keywords {
			keywordKeywordMap[keyword.(map[string]interface{})["keyword"].(string)] = keyword.(map[string]interface{})
		}

		// set the name of the filter file to be filter-<title>.json make sure any spaces are replaced with underscores and slashes are replace with dashes
		filename := filepath.Join("filter-"+strings.ReplaceAll(strings.ReplaceAll(title, " ", "_"), "/", "-")+".json")

		// Prettify and write the filter to a file in the export directory.
		data, err := json.MarshalIndent(filters, "", "  ")
		if err != nil {
			return fmt.Errorf("error marshaling filter: %w", err)
		}
		if err :=
			ioutil.WriteFile(filepath.Join(config.FilterExport, filename), data, 0644); err != nil {
			return fmt.Errorf("error writing filter file: %w", err)
		}
	}

	PrettifyJSONFiles(config.FilterExport)

	return nil
}

// downloadFilters downloads the user's current filters.
func downloadFilters(config *MastodonConfig) ([]byte, error) {
	// Create an HTTP client.
	client := &http.Client{}


	// Create an HTTP request to download the user's filters.
	req, err := http.NewRequest("GET", config.InstanceURL+"/api/v2/filters", nil)
	if err != nil {
		return nil, fmt.Errorf("error creating request: %w", err)
	}

	// Set the authorization header.
	req.Header.Set("Authorization", "Bearer "+config.AccessToken)

	// Send the request and get the response.
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("error sending request: %w", err)
	}
	defer resp.Body.Close()

	// Check the response status code.
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("received non-200 response: %d", resp.StatusCode)
	}

	// Read the response body.
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("error reading response body: %w", err)
	}

	return body, nil
}




// importFilters imports filters using the specified configuration.
func importFilters(config *MastodonConfig) error {
	// Check if the import directory or URL is specified.
	if config.FilterImport == "" && config.FilterURL == "" {
	return fmt.Errorf("missing filters_import or filters_url in configuration")
	}

	// Download the user's current filters.
	currentFilters, err := downloadFilters(config)
	if err != nil {
		return fmt.Errorf("error downloading filters: %w", err)
	}

	// Get the filters to import.
	var importFilters []byte
	if config.FilterImport != "" {
		// Read the filters from the import directory.
		importFilters, err = ioutil.ReadFile(filepath.Join(config.FilterImport, "filters.json"))
		if err != nil {
			return fmt.Errorf("error reading import filters: %w", err)
		}
	} else {
		// Download the filters from the import URL.
		importFilters, err = downloadURL(config.FilterURL)
		if err != nil {
			return fmt.Errorf("error downloading import filters: %w", err)
		}
	}
		// // convert the data to string
		// var currentString string = string(currentFilters)
		// var importString string = string(importFilters)

	// Show a diff of the pending changes.
	diff := difflib.UnifiedDiff{
		A:        difflib.SplitLines(string(currentFilters)),
		B:        difflib.SplitLines(string(importFilters)),
		FromFile: "Current Filters",
		ToFile:   "Import Filters",
		Context:  3,
	}

	text, err := difflib.GetUnifiedDiffString(diff)
	if err != nil {
		return fmt.Errorf("error generating diff: %w", err)
	}

	fmt.Println(text)

	// Prompt the user to confirm the import.
	if !confirmImport() {
		return nil
	}

	// Upload the imported filters.
	if err := uploadFilters(config); err != nil {
		return fmt.Errorf("error uploading filters: %w", err)
	}

	return nil
}

// downloadURL downloads the contents of the specified URL.
func downloadURL(url string) ([]byte, error) {
// Create an HTTP client.
client := &http.Client{}
// Create an HTTP request to download the file.
req, err := http.NewRequest("GET", url, nil)
if err != nil {
	return nil, fmt.Errorf("error creating request: %w", err)
}

// Send the request and get the response.
resp, err := client.Do(req)
if err != nil {
	return nil, fmt.Errorf("error sending request: %w", err)
	}
	defer resp.Body.Close()
// Check the response status code.
if resp.StatusCode != http.StatusOK {
	return nil, fmt.Errorf("received non-200 response: %d", resp.StatusCode)
}

// Read the response body.
body, err := ioutil.ReadAll(resp.Body)
if err != nil {
	return nil, fmt.Errorf("error reading response body: %w", err)
}

return body, nil
}

// showDiff shows a diff of the changes between the current and imported filters or tags JSON.
func showDiff(current, imported []map[string]interface{}) error {
	// Create a temporary file for the current filters.
	currentFile, err := ioutil.TempFile("", "current-*.json")
	if err != nil {
		return fmt.Errorf("error creating current filters file: %w", err)
	}

	defer os.Remove(currentFile.Name())
	// Write the current filters to the temporary file as JSON.
	if err := json.NewEncoder(currentFile).Encode(current); err != nil {
		return fmt.Errorf("error writing current filters: %w", err)
	}


	// Create a temporary file for the imported filters.
	importFile, err := ioutil.TempFile("", "import-*.json")
	if err != nil {
		return fmt.Errorf("error creating import filters file: %w", err)
	}

	defer os.Remove(importFile.Name())
	// Write the imported filters to the temporary file as JSON.
	if err := json.NewEncoder(importFile).Encode(imported); err != nil {
		return fmt.Errorf("error writing import filters: %w", err)
	}


	// Create a diff command.
	cmd := exec.Command("diff", "-u", currentFile.Name(), importFile.Name())
	// Set the output to stdout.
	cmd.Stdout = os.Stdout
	// Run the diff command.
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("error running diff command: %w", err)
	}
	return nil
}

// confirmImport prompts the user to confirm the import.
func confirmImport() bool {
	// Print a message asking the user to confirm the import.
	fmt.Print("Do you want to import the changes (y/n)? ")

	// Read the user's input.
	reader := bufio.NewReader(os.Stdin)
	input, err := reader.ReadString('\n')
	if err != nil {
		return false
	}

	// Return true if the user confirmed the import, or false otherwise.
	return strings.TrimSpace(input) == "y"

	}

	// printMenu prints the menu and gets the user's choice.
	func printMenu() (int, error) {
	// Print the menu.
	fmt.Println("Export")
	fmt.Println(" 1. Filters")
	fmt.Println(" 2. Tags")
	fmt.Println("-")
	fmt.Println("Import from file")
	fmt.Println(" 3. Filters")
	fmt.Println(" 4. Tags")
	fmt.Println("-")
	fmt.Println("Create interactively")
	fmt.Println(" 5. Tag")
	fmt.Println(" 6. Filter")

	// fmt.Println("Import from URL")
	// fmt.Println(" 7. Filters")
	// fmt.Println(" 8. Tags")
	// fmt.Println("-")
	fmt.Print("Enter your choice: ")
// Read the user's input.
reader := bufio.NewReader(os.Stdin)
input, err := reader.ReadString('\n')
if err != nil {
	return 0, fmt.Errorf("error reading input: %w", err)
}

// Parse the user's choice and return it.
choice, err := strconv.Atoi(strings.TrimSpace(input))
if err != nil {
	return 0, fmt.Errorf("error parsing input: %w", err)
}
return choice, nil

}

// uploadFilters uploads filters to the user's account using the v2 api.
func uploadFilters(config *MastodonConfig) error {
	// Check if the import directory is specified.
	if config.FilterImport == "" {
	return fmt.Errorf("missing filters_import in configuration")
	}

	// Read the files in the import directory.
	files, err := ioutil.ReadDir(config.FilterImport)
	if err != nil {
		return fmt.Errorf("error reading import directory: %w", err)
	}

	// For each file, unmarshal the JSON data and upload the filter.
	for _, file := range files {
		// Only process files that end with ".json".
		if !strings.HasSuffix(file.Name(), ".json") {
			continue
		}

		// Read the file contents.
		contents, err := ioutil.ReadFile(filepath.Join(config.FilterImport, file.Name()))
		if err != nil {
			return fmt.Errorf("error reading file %s: %w", file.Name(), err)
		}

		// Unmarshal the JSON data.
		var filter map[string]interface{}
		if err := json.Unmarshal(contents, &filter); err != nil {
			return fmt.Errorf("error parsing filter data from file %s: %w", file.Name(), err)
		}

		// Create an HTTP client.
		client := &http.Client{}

		// Create an HTTP request to upload the filter.
		req, err := http.NewRequest("POST", config.InstanceURL+"/api/v2/filters", bytes.NewBuffer(contents))
		if err != nil {
			return fmt.Errorf("error creating request: %w", err)
		}

		// Set the authorization header.
		req.Header.Set("Authorization", "Bearer "+config.AccessToken)
		req.Header.Set("Content-Type", "application/json")

		// Send the request and get the response.
		resp, err := client.Do(req)
		if err != nil {
			return fmt.Errorf("error sending request: %w", err)
		}
		defer resp.Body.Close()

		// Check the response status code.
		if resp.StatusCode != http.StatusOK {
			return fmt.Errorf("received non-200 response: %d", resp.StatusCode)
		}
	}

	return nil
}


// exportTags exports the user's tags using the specified configuration.
func exportTags(config *MastodonConfig) error {
  // Check if the export directory is specified.
  if config.TagsExport == "" {
    return fmt.Errorf("missing tags_export in configuration")
  }

  // Create the export directory if it does not exist.
  if err := os.MkdirAll(config.TagsExport, 0755); err != nil {
    return fmt.Errorf("error creating export directory: %w", err)
  }

  // Download the user's current tags.
  tags, err := downloadTags(config)
  if err != nil {
    return fmt.Errorf("error downloading tags: %w", err)
  }

	// Create a map to store each tag indexed by the "name" key.
	tagMap := make(map[string]interface{})

	// Iterate over the tags and add them to the map.
	for _, tag := range tags {
		tagMap[tag["name"].(string)] = tag

		// Clean up the JSON.
		delete(tag, "history")
	}


  // Iterate over the entries in the map.
  for key, value := range tagMap {

    // Marshal the value into JSON.
    jsonBytes, err := json.Marshal(value)
    if err != nil {
      return fmt.Errorf("error marshalling JSON: %w", err)
    }

    // Write the JSON to a file named after the key.
    err = ioutil.WriteFile(filepath.Join(config.TagsExport, key+".json"), jsonBytes, 0644)
    if err != nil {
      return fmt.Errorf("error writing JSON to file: %w", err)
    }
  }

	PrettifyJSONFiles(config.TagsExport)

  return nil
}


// downloadTags downloads the user's current tags.
func downloadTags(config *MastodonConfig) ([]map[string]interface{}, error) {

	// Create an HTTP client.
	client := &http.Client{}

	// Create an HTTP request to download the user's tags.
	req, err := http.NewRequest("GET", config.InstanceURL+"/api/v1/followed_tags", nil)
	if err != nil {
		return nil, fmt.Errorf("error creating request: %w", err)
	}

	// Set the authorization header.
	req.Header.Set("Authorization", "Bearer "+config.AccessToken)

	// Send the request and get the response.
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("error sending request: %w", err)
	}
	defer resp.Body.Close()

	// Check the response status code.
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("received non-200 response: %d", resp.StatusCode)
	}


	// Read the response body.
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("error reading response body: %w", err)
	}



  // Unmarshal the byte slice into a slice of JSON objects.
  var tags []map[string]interface{}
  if err := json.Unmarshal(body, &tags); err != nil {
    return nil, fmt.Errorf("error unmarshalling tags: %w", err)
  }

	return tags, nil

}

// importFromDirectory imports data from the specified directory using the provided import function.
func importFromDirectory(directory string, importFn func(filename string, data []byte) error) error {
	// Get a list of files in the directory.
	files, err := ioutil.ReadDir(directory)
	if err != nil {
	return fmt.Errorf("error reading directory: %w", err)
	}

	// Loop through the files and import the data.
	for _, file := range files {
		// Read the file data.
		data, err := ioutil.ReadFile(filepath.Join(directory, file.Name()))
		if err != nil {
			return fmt.Errorf("error reading file: %w", err)
		}

		// Import the data.
		if err := importFn(file.Name(), data); err != nil {
			return fmt.Errorf("error importing file: %w", err)
		}
	}

	return nil
	}

// importTagsFromDirectory imports the user's tags from the specified directory using the provided import function.
func importTagsFromDirectory(directory string, importFn func(filename string, data []byte) error) error {
	return importFromDirectory(directory, importFn)
}


// importTags imports the user's tags from the specified directory or URL.
func importTags(config *MastodonConfig) error {
	// Download the current tags.
	current, err := downloadTags(config)
	if err != nil {
		return fmt.Errorf("error downloading tags: %w", err)
	}

// Check if a URL is specified.
if config.TagsURL != "" {
	// Download the tags from the URL.
	imported, err := downloadTags(config)
	if err != nil {
		return fmt.Errorf("error downloading tags from URL: %w", err)
	}

	// Show a diff of the changes.
	if err := showDiff(current, imported); err != nil {
		return fmt.Errorf("error showing diff: %w", err)
	}
} else {
	// Check if a directory is specified.
	if config.TagsImport == "" {
		return fmt.Errorf("no import source specified")
	}

	// Import the tags from the directory.
	if err := importTagsFromDirectory(config.TagsImport, func(filename string, data []byte) error {
		// Download the tags from the URL.
		imported, err := downloadTags(config)
		if err != nil {
			return fmt.Errorf("error downloading tags from URL: %w", err)
		}
		// Show a diff of the changes.
		if err := showDiff(current, imported); err != nil {
			return fmt.Errorf("error showing diff: %w", err)
		}

		// Prompt the user to confirm the import.
		if confirmed := confirmImport(); !confirmed {
			return fmt.Errorf("import cancelled")
		}

		// Upload the tags.
		if err := uploadTags(config, data); err != nil {
			return fmt.Errorf("error uploading tags: %w", err)
		}

			return nil
		}); err != nil {
			return fmt.Errorf("error importing tags: %w", err)
		}
	}
	return nil
}

// uploadTags uploads the specified tags to the user's account.
func uploadTags(config *MastodonConfig, tags []byte) error { //TODO: this probably shouldn't be posting byte, but instead JSON?
	// Create an HTTP client.
	client := &http.Client{}
	// Create an HTTP request to upload the tags.
	req, err := http.NewRequest("POST", config.InstanceURL+"/api/v1/tag_following", bytes.NewBuffer(tags))
	if err != nil {
	return fmt.Errorf("error creating request: %w", err)
	}

	// Set the authorization header.
	req.Header.Set("Authorization", "Bearer "+config.AccessToken)

	// Send the request and get the response.
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("error sending request: %w", err)
	}
	defer resp.Body.Close()

	// Check the response status code.
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("received non-200 response: %d", resp.StatusCode)
	}
	return nil
}

// A function that add from inputs.
func createTag(config *MastodonConfig) ([]byte, error) {
	// ask the user to input the tag name, assign it to a variable
	var tagName string
	fmt.Print("Enter the tag name: ")
	fmt.Scanln(&tagName)


	// Convert the tag to JSON.
	data, err := json.Marshal(tagName)
	if err != nil {
		return nil, fmt.Errorf("error converting tag to JSON: %w", err)
	}

	// Upload the tag.
	if err := uploadTags(config, data); err != nil {
		return nil, fmt.Errorf("error uploading tag: %w", err)
	}

	return data, nil
}


// Define configTemplate as json
var configTemplate = []byte(`{
	"instance_url": "https://mastodon.social",
	"access_token": "REPLACEME",
	"tags_export": "export/",
	"tags_import": "import/",
	"tags_url": "",
	"filters_export": "export/",
	"filters_import": "import/",
	"filters_url": ""
}`)


// add a function that generates a config.json if it doesn't exist
func generateConfig(configFile string) error {
	// Check if the config file exists.
	if _, err := os.Stat(configFile); err == nil {
		return nil
	}

	// Create the config file.
	f, err := os.Create(configFile)
	if err != nil {
		return fmt.Errorf("error creating config file: %w", err)
	}
	defer f.Close()

	// Write the config file template.
	if _, err := f.Write(configTemplate); err != nil {
		return fmt.Errorf("error writing config file: %w", err)
	}

	// Prompt the user to edit the config file.
	fmt.Println("Please edit the config file and then run the program again.")
	fmt.Println("Config file path: " + configFile)

	return nil
}
// PrettifyJSONFiles reads all JSON files in the specified directory, prettifies them, and saves them to the same files.
func PrettifyJSONFiles(dir string) error {

	jsonData, err := ioutil.ReadFile("configFile.json")
	if err != nil {
		return fmt.Errorf("error reading configFile.json: %w", err)
	}
	var prettifyConfig map[string]interface{}
	if err := json.Unmarshal(jsonData, &prettifyConfig); err != nil {
		return fmt.Errorf("error parsing configFile.json: %w", err)
	}
	if prettifyConfig["prettify"].(bool) {


	// Get a list of all files in the specified directory
	files, err := ioutil.ReadDir(dir)
	if err != nil {
			return fmt.Errorf("failed to read directory: %v", err)
	}

	// Loop over the files in the directory
	for _, file := range files {
			// Skip any files that are not JSON files
			if filepath.Ext(file.Name()) != ".json" {
					continue
			}

				// Open the file
			input, err := os.Open(filepath.Join(dir, file.Name()))
			if err != nil {
					return fmt.Errorf("failed to open file: %v", err)
			}
			defer input.Close()

			// Decode the JSON from the file
			var data interface{}
			if err := json.NewDecoder(input).Decode(&data); err != nil {
					return fmt.Errorf("failed to decode JSON from file: %v", err)
			}

			// Prettify the JSON data
			prettified, err := json.MarshalIndent(data, "", "    ")
			if err != nil {
					return fmt.Errorf("failed to prettify JSON data: %v", err)
			}

			// Open the file for writing
			output, err := os.OpenFile(filepath.Join(dir, file.Name()), os.O_WRONLY, 0)
			if err != nil {
					return fmt.Errorf("failed to open file for writing: %v", err)
			}
			defer output.Close()

			// Write the prettified JSON to the file
			if _, err := output.Write(prettified); err != nil {
					return fmt.Errorf("failed to write prettified JSON to file: %v", err)
			}
		}
	}

	return nil
}


var configFile = flag.String("config", "config.json", "the path to the config file")

// Main is the entry point of the program.
func main() {
// Parse the command line arguments.
flag.Parse()

// Generate the config file if it doesn't exist.
if err := generateConfig(*configFile); err != nil {
	log.Fatalf("error generating config file: %v", err)
}


// Load the configuration from the config file.
config, err := loadConfig(*configFile)
if err != nil {
	fmt.Printf("error loading configuration: %s\n", err)
	os.Exit(1)
}

// Print the menu and get the user's choice.
choice, err := printMenu()
if err != nil {
	fmt.Printf("error getting menu choice: %s\n", err)
	os.Exit(1)
}

// Perform the selected action.
switch choice {
case 1:
	if err := exportFilters(config); err != nil {
		fmt.Printf("error exporting filters: %s\n", err)
		os.Exit(1)
	}
case 2:
	if err := exportTags(config); err != nil {
		fmt.Printf("error exporting tags: %s\n", err)
		os.Exit(1)
	}
case 3:
	if err := importFilters(config); err != nil {
		fmt.Printf("error importing filters: %s\n", err)
		os.Exit(1)
	}
case 4:
	if err := importTags(config); err != nil {
		fmt.Printf("error importing tags: %s\n", err)
		os.Exit(1)
	}
case 5:
	createTag(config)
case 6:
	// TODO:
}

// Print a summary of the performed action.
fmt.Printf("Action completed successfully.\n")

}
{{< /code-block >}}
