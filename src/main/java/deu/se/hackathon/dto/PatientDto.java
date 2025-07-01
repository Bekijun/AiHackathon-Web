package deu.se.hackathon.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PatientDto {
    private String name;
    private String gender;
    private int age;
    private String symptoms;
}
