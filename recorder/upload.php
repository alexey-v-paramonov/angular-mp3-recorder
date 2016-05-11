<?php
header("Access-Control-Allow-Origin: *");
header('Content-Type: application/json');

$response = array(
    'success' => FALSE
);

// pull the raw binary data from the POST array
$data = substr($_POST['data'], strpos($_POST['data'], ",") + 1);

if(!empty($data)){
    $decodedData = base64_decode($data);
    $filename = tempnam("/tmp", "recording_").".mp3";

    // write the data out to the file
    $fp = fopen($filename, 'wb');
    if($fp){
        $bytes = fwrite($fp, $decodedData);
        if($bytes){
            $response['message'] = $filename;
            $response['success'] = TRUE;
        }
        else{
            $response['message'] = 'Unable to write data to'.$filename;
        }
    }
    else{
        $response['message'] = "Unable to open file ".$filename." to save the payload";
    }
    fclose($fp);
}
else{
    $response['message'] = 'Payload is empty';
}

echo json_encode($response);

?>